/**
 * FUB Sync Edge Function
 *
 * Syncs leads from Follow Up Boss API to fub_leads table.
 * Supports full and incremental syncs.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { FubClient, transformFubPerson } from "../_shared/fub-client.ts";
import { queueForEmbedding } from "../_shared/embeddings.ts";

interface SyncRequest {
  fub_connection_id?: string;
  organization_id?: string;
  sync_type?: "full" | "incremental";
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json()) as SyncRequest;
    const supabase = createServiceClient();

    // Get FUB connections to sync
    let connectionsQuery = supabase
      .from("fub_connections")
      .select("*, organizations(id, name)")
      .eq("is_active", true);

    if (body.fub_connection_id) {
      connectionsQuery = connectionsQuery.eq("id", body.fub_connection_id);
    } else if (body.organization_id) {
      connectionsQuery = connectionsQuery.eq("organization_id", body.organization_id);
    }

    const { data: connections, error: connError } = await connectionsQuery;

    if (connError || !connections || connections.length === 0) {
      return jsonResponse({
        success: true,
        message: "No active FUB connections to sync",
      });
    }

    const syncResults = [];

    for (const connection of connections) {
      const syncLogId = crypto.randomUUID();

      // Create sync log entry
      await supabase.from("fub_sync_log").insert({
        id: syncLogId,
        fub_connection_id: connection.id,
        sync_type: body.sync_type || "incremental",
        status: "running",
        started_at: new Date().toISOString(),
      });

      try {
        // Decrypt API key (in production, use proper encryption)
        // For now, assuming it's stored as-is or using Supabase Vault
        const apiKey = connection.api_key_encrypted;

        const fubClient = new FubClient({ apiKey });

        // Verify connection
        const { valid } = await fubClient.verifyConnection();
        if (!valid) {
          throw new Error("Invalid FUB API key");
        }

        // Get users for assignment mapping
        const users = await fubClient.getUsers();
        const usersMap = new Map(users.map((u) => [u.id, u]));

        // Determine sync parameters
        const syncConfig = connection.sync_config || {};
        const isIncremental = body.sync_type !== "full" && connection.last_sync_at;

        const syncParams: { updatedAfter?: string; batchSize?: number } = {
          batchSize: 100,
        };

        if (isIncremental && connection.last_sync_at) {
          syncParams.updatedAfter = connection.last_sync_at;
        }

        let leadsCreated = 0;
        let leadsUpdated = 0;
        let leadsFetched = 0;
        const errors: string[] = [];

        // Iterate through FUB people
        for await (const batch of fubClient.iteratePeople(syncParams)) {
          leadsFetched += batch.length;

          for (const person of batch) {
            try {
              const leadData = transformFubPerson(
                person,
                connection.id,
                connection.organization_id,
                usersMap
              );

              // Check if lead exists
              const { data: existing } = await supabase
                .from("fub_leads")
                .select("id, sync_hash")
                .eq("fub_connection_id", connection.id)
                .eq("fub_lead_id", person.id)
                .single();

              if (existing) {
                // Update if changed
                if (existing.sync_hash !== leadData.sync_hash) {
                  const { error: updateError } = await supabase
                    .from("fub_leads")
                    .update({
                      ...leadData,
                      last_synced_at: new Date().toISOString(),
                    })
                    .eq("id", existing.id);

                  if (updateError) {
                    errors.push(`Update failed for FUB lead ${person.id}: ${updateError.message}`);
                  } else {
                    leadsUpdated++;

                    // Queue for re-embedding if data changed
                    const embeddingText = generateFubEmbeddingText(leadData);
                    await queueForEmbedding(supabase, "fub_leads", existing.id, embeddingText);
                  }
                }
              } else {
                // Create new lead
                const { data: newLead, error: insertError } = await supabase
                  .from("fub_leads")
                  .insert(leadData)
                  .select("id")
                  .single();

                if (insertError) {
                  errors.push(`Insert failed for FUB lead ${person.id}: ${insertError.message}`);
                } else {
                  leadsCreated++;

                  // Queue for embedding
                  const embeddingText = generateFubEmbeddingText(leadData);
                  await queueForEmbedding(supabase, "fub_leads", newLead.id, embeddingText);
                }
              }
            } catch (err) {
              errors.push(`Error processing FUB lead ${person.id}: ${err}`);
            }
          }
        }

        // Update sync log
        await supabase
          .from("fub_sync_log")
          .update({
            status: errors.length > 0 ? "completed_with_errors" : "completed",
            leads_fetched: leadsFetched,
            leads_created: leadsCreated,
            leads_updated: leadsUpdated,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - new Date(connection.last_sync_at || Date.now()).getTime(),
            errors: errors.length > 0 ? errors.slice(0, 100) : [], // Limit errors stored
          })
          .eq("id", syncLogId);

        // Update connection
        await supabase
          .from("fub_connections")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: errors.length > 0 ? "completed_with_errors" : "completed",
          })
          .eq("id", connection.id);

        syncResults.push({
          connection_id: connection.id,
          organization: (connection.organizations as { name: string })?.name,
          success: true,
          leads_fetched: leadsFetched,
          leads_created: leadsCreated,
          leads_updated: leadsUpdated,
          errors: errors.length,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";

        await supabase
          .from("fub_sync_log")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            errors: [errorMessage],
          })
          .eq("id", syncLogId);

        await supabase
          .from("fub_connections")
          .update({
            last_sync_status: "failed",
          })
          .eq("id", connection.id);

        syncResults.push({
          connection_id: connection.id,
          success: false,
          error: errorMessage,
        });
      }
    }

    return jsonResponse({
      success: true,
      syncs: syncResults,
    });
  } catch (error) {
    console.error("FUB sync error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

/**
 * Generate embedding text for a FUB lead
 */
function generateFubEmbeddingText(lead: ReturnType<typeof transformFubPerson>): string {
  const parts = [
    "FUB Lead",
    lead.first_name && lead.last_name ? `${lead.first_name} ${lead.last_name}` : "",
    lead.email ? `email: ${lead.email}` : "",
    lead.phone ? `phone: ${lead.phone}` : "",
    lead.address ? `address: ${lead.address}` : "",
    lead.city || "",
    lead.state || "",
    lead.zip || "",
    lead.assigned_user_name ? `assigned to: ${lead.assigned_user_name}` : "",
    lead.fub_source ? `source: ${lead.fub_source}` : "",
    lead.fub_stage ? `stage: ${lead.fub_stage}` : "",
  ];

  return parts.filter((p) => p).join(", ");
}
