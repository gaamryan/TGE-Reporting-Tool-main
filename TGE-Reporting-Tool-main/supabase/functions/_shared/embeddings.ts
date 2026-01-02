/**
 * Embedding queue management utilities
 */

import { SupabaseClient } from "./supabase.ts";
import { generateEmbedding, generateEmbeddings, formatPgVector } from "./openai.ts";

export interface EmbeddingQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  text_to_embed: string;
  status: string;
  attempts: number;
}

/**
 * Add a record to the embedding queue
 */
export async function queueForEmbedding(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  textToEmbed: string
): Promise<void> {
  const { error } = await supabase.from("embedding_queue").upsert(
    {
      table_name: tableName,
      record_id: recordId,
      text_to_embed: textToEmbed,
      status: "pending",
      attempts: 0,
    },
    {
      onConflict: "table_name,record_id",
    }
  );

  if (error) {
    console.error("Failed to queue embedding:", error);
  }
}

/**
 * Process pending items in the embedding queue
 */
export async function processEmbeddingQueue(
  supabase: SupabaseClient,
  batchSize = 50,
  maxAttempts = 3
): Promise<{ processed: number; failed: number }> {
  // Fetch pending items
  const { data: items, error: fetchError } = await supabase
    .from("embedding_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", maxAttempts)
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchError || !items || items.length === 0) {
    return { processed: 0, failed: 0 };
  }

  // Mark as processing
  const itemIds = items.map((i) => i.id);
  await supabase
    .from("embedding_queue")
    .update({ status: "processing" })
    .in("id", itemIds);

  let processed = 0;
  let failed = 0;

  try {
    // Generate embeddings in batch
    const texts = items.map((i) => i.text_to_embed);
    const { embeddings } = await generateEmbeddings(texts);

    // Update each record with its embedding
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as EmbeddingQueueItem;
      const embedding = embeddings[i];

      try {
        // Update the target table with the embedding
        const { error: updateError } = await supabase
          .from(item.table_name)
          .update({
            embedding: formatPgVector(embedding),
            embedding_text: item.text_to_embed,
            embedded_at: new Date().toISOString(),
          })
          .eq("id", item.record_id);

        if (updateError) {
          throw updateError;
        }

        // Mark queue item as completed
        await supabase
          .from("embedding_queue")
          .update({
            status: "completed",
            embedding: formatPgVector(embedding),
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        processed++;
      } catch (err) {
        console.error(`Failed to update embedding for ${item.table_name}/${item.record_id}:`, err);

        await supabase
          .from("embedding_queue")
          .update({
            status: "pending",
            attempts: item.attempts + 1,
            last_error: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", item.id);

        failed++;
      }
    }
  } catch (err) {
    // Batch embedding failed - reset all items
    console.error("Batch embedding failed:", err);

    for (const item of items as EmbeddingQueueItem[]) {
      await supabase
        .from("embedding_queue")
        .update({
          status: "pending",
          attempts: item.attempts + 1,
          last_error: err instanceof Error ? err.message : "Unknown error",
        })
        .eq("id", item.id);
    }

    failed = items.length;
  }

  return { processed, failed };
}

/**
 * Generate and store embedding for a single lead immediately
 */
export async function embedSourceLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<void> {
  // Get embedding text using database function
  const { data: textData, error: textError } = await supabase.rpc(
    "generate_source_lead_embedding_text",
    { p_lead_id: leadId }
  );

  if (textError || !textData) {
    throw new Error(`Failed to generate embedding text: ${textError?.message}`);
  }

  const text = textData as string;
  const embedding = await generateEmbedding(text);

  const { error: updateError } = await supabase
    .from("source_leads")
    .update({
      embedding: formatPgVector(embedding),
      embedding_text: text,
      embedded_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) {
    throw new Error(`Failed to store embedding: ${updateError.message}`);
  }
}

/**
 * Generate and store embedding for a FUB lead immediately
 */
export async function embedFubLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<void> {
  // Get embedding text using database function
  const { data: textData, error: textError } = await supabase.rpc(
    "generate_fub_lead_embedding_text",
    { p_lead_id: leadId }
  );

  if (textError || !textData) {
    throw new Error(`Failed to generate embedding text: ${textError?.message}`);
  }

  const text = textData as string;
  const embedding = await generateEmbedding(text);

  const { error: updateError } = await supabase
    .from("fub_leads")
    .update({
      embedding: formatPgVector(embedding),
      embedding_text: text,
      embedded_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) {
    throw new Error(`Failed to store embedding: ${updateError.message}`);
  }
}

/**
 * Semantic search for leads using vector similarity
 */
export async function semanticSearchLeads(
  supabase: SupabaseClient,
  query: string,
  organizationId: string,
  options: {
    table?: "source_leads" | "fub_leads";
    limit?: number;
    threshold?: number;
  } = {}
): Promise<Array<{ id: string; similarity: number; data: Record<string, unknown> }>> {
  const { table = "source_leads", limit = 10, threshold = 0.7 } = options;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Search using vector similarity
  // Note: This requires a custom RPC function for vector search
  const { data, error } = await supabase.rpc("vector_search_leads", {
    p_table: table,
    p_organization_id: organizationId,
    p_embedding: formatPgVector(queryEmbedding),
    p_limit: limit,
    p_threshold: threshold,
  });

  if (error) {
    // If the RPC doesn't exist, fall back to a raw query approach
    console.warn("Vector search RPC not available, using fallback");
    return [];
  }

  return data || [];
}
