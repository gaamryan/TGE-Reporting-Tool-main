/**
 * Embedding Worker Edge Function
 *
 * Processes the embedding queue, generating OpenAI embeddings for queued records.
 * Designed to be called on a cron schedule.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { processEmbeddingQueue } from "../_shared/embeddings.ts";

interface WorkerRequest {
  batch_size?: number;
  max_attempts?: number;
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = (await req.json().catch(() => ({}))) as WorkerRequest;
    const supabase = createServiceClient();

    const batchSize = body.batch_size || 50;
    const maxAttempts = body.max_attempts || 3;

    // Process queue
    const result = await processEmbeddingQueue(supabase, batchSize, maxAttempts);

    // Get queue stats
    const { count: pendingCount } = await supabase
      .from("embedding_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: failedCount } = await supabase
      .from("embedding_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    return jsonResponse({
      success: true,
      processed: result.processed,
      failed: result.failed,
      queue_stats: {
        pending: pendingCount || 0,
        failed: failedCount || 0,
      },
    });
  } catch (error) {
    console.error("Embedding worker error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});
