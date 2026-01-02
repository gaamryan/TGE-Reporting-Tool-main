/**
 * AI Query Edge Function
 *
 * Chat with data endpoint. Uses OpenAI function calling to query the database
 * and provide natural language responses about leads and matches.
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createServiceClient, createUserClient, getUserFromHeader } from "../_shared/supabase.ts";
import { chatCompletion, dataQueryFunctions, generateEmbedding, formatPgVector } from "../_shared/openai.ts";

interface QueryRequest {
  conversation_id?: string;
  message: string;
  organization_id?: string;
}

serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createUserClient(authHeader);
    const serviceClient = createServiceClient();

    // Get user from auth header
    const user = await getUserFromHeader(supabase, authHeader);
    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = (await req.json()) as QueryRequest;

    if (!body.message) {
      return errorResponse("Missing message", 400);
    }

    // Get or create conversation
    let conversationId = body.conversation_id;
    let organizationId = body.organization_id;

    if (conversationId) {
      // Verify conversation belongs to user
      const { data: conv, error: convError } = await supabase
        .from("ai_conversations")
        .select("id, organization_id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();

      if (convError || !conv) {
        return errorResponse("Conversation not found", 404);
      }

      organizationId = conv.organization_id;
    } else {
      // Create new conversation
      if (!organizationId) {
        return errorResponse("Missing organization_id for new conversation", 400);
      }

      const { data: newConv, error: createError } = await supabase
        .from("ai_conversations")
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          title: body.message.slice(0, 100),
        })
        .select("id")
        .single();

      if (createError || !newConv) {
        return errorResponse("Failed to create conversation", 500);
      }

      conversationId = newConv.id;
    }

    // Get conversation history
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content, function_name, function_result")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build messages for OpenAI
    const messages: Array<{ role: string; content: string; name?: string }> = [
      {
        role: "system",
        content: `You are an AI assistant helping real estate professionals analyze their lead data.
You have access to a database of leads from various sources (Zillow, Realtor.com, etc.) and their matches in Follow Up Boss CRM.

When users ask questions about their leads, use the available functions to query the database and provide accurate, data-driven responses.

Organization context: You are working with data for organization ID: ${organizationId}

Always be helpful and provide specific numbers when possible. If you need to run multiple queries to answer a question, do so.`,
      },
    ];

    // Add history
    if (history) {
      for (const msg of history) {
        messages.push({
          role: msg.role,
          content: msg.content,
          ...(msg.function_name && { name: msg.function_name }),
        });
      }
    }

    // Add user message
    messages.push({ role: "user", content: body.message });

    // Save user message
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: body.message,
    });

    // Call OpenAI with function calling
    const response = await chatCompletion(
      messages as Parameters<typeof chatCompletion>[0],
      {
        functions: dataQueryFunctions,
        function_call: "auto",
      }
    );

    let assistantMessage = response.message;
    let functionResults: Record<string, unknown>[] = [];

    // Handle function calls
    while (assistantMessage.function_call) {
      const functionName = assistantMessage.function_call.name;
      const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

      console.log(`Calling function: ${functionName}`, functionArgs);

      // Execute the function
      const result = await executeFunction(
        serviceClient,
        functionName,
        { ...functionArgs, organization_id: organizationId }
      );

      functionResults.push({ function: functionName, args: functionArgs, result });

      // Add function result to messages
      messages.push({
        role: "assistant",
        content: "",
        ...assistantMessage,
      });
      messages.push({
        role: "function",
        name: functionName,
        content: JSON.stringify(result),
      });

      // Get next response
      const nextResponse = await chatCompletion(
        messages as Parameters<typeof chatCompletion>[0],
        {
          functions: dataQueryFunctions,
          function_call: "auto",
        }
      );

      assistantMessage = nextResponse.message;
    }

    // Save assistant message
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantMessage.content,
      function_result: functionResults.length > 0 ? functionResults : null,
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
    });

    // Update conversation
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return jsonResponse({
      conversation_id: conversationId,
      message: assistantMessage.content,
      function_calls: functionResults.length > 0 ? functionResults : undefined,
    });
  } catch (error) {
    console.error("AI query error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
});

/**
 * Execute a data query function
 */
async function executeFunction(
  supabase: ReturnType<typeof createServiceClient>,
  functionName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (functionName) {
    case "query_leads": {
      let query = supabase
        .from("v_lead_attribution")
        .select("*")
        .eq("organization_id", args.organization_id);

      if (args.lead_source) {
        query = query.eq("lead_source_slug", args.lead_source);
      }
      if (args.match_status) {
        query = query.eq("match_status", args.match_status);
      }
      if (args.date_from) {
        query = query.gte("source_created_at", args.date_from);
      }
      if (args.date_to) {
        query = query.lte("source_created_at", args.date_to);
      }

      const { data, error } = await query.limit((args.limit as number) || 100);

      if (error) {
        return { error: error.message };
      }

      return { leads: data, count: data?.length || 0 };
    }

    case "get_source_summary": {
      const { data, error } = await supabase
        .from("v_source_summary")
        .select("*")
        .eq("organization_id", args.organization_id);

      if (error) {
        return { error: error.message };
      }

      return { sources: data };
    }

    case "get_team_summary": {
      const { data, error } = await supabase
        .from("v_team_summary")
        .select("*")
        .eq("organization_id", args.organization_id);

      if (error) {
        return { error: error.message };
      }

      return { teams: data };
    }

    case "semantic_search_leads": {
      const queryEmbedding = await generateEmbedding(args.query as string);

      // Use raw SQL for vector similarity search
      const { data, error } = await supabase.rpc("vector_search_source_leads", {
        p_organization_id: args.organization_id,
        p_embedding: formatPgVector(queryEmbedding),
        p_limit: (args.limit as number) || 10,
      });

      if (error) {
        // Fallback to text search if vector search not available
        const { data: textData } = await supabase
          .from("source_leads")
          .select("id, email, first_name, last_name, property_address, lead_type")
          .eq("organization_id", args.organization_id)
          .or(`email.ilike.%${args.query}%,first_name.ilike.%${args.query}%,last_name.ilike.%${args.query}%,property_address.ilike.%${args.query}%`)
          .limit((args.limit as number) || 10);

        return { leads: textData, search_type: "text_fallback" };
      }

      return { leads: data, search_type: "semantic" };
    }

    default:
      return { error: `Unknown function: ${functionName}` };
  }
}
