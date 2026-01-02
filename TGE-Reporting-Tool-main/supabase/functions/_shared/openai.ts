/**
 * OpenAI client utilities for Edge Functions
 */

const OPENAI_API_URL = "https://api.openai.com/v1";
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4-turbo-preview";

interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Get the OpenAI API key from environment
 */
function getApiKey(): string {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  return apiKey;
}

/**
 * Generate embeddings for a text string
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getApiKey();

  const response = await fetch(`${OPENAI_API_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as OpenAIError;
    throw new Error(`OpenAI API error: ${error.error.message}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<{ embeddings: number[][]; tokens: number }> {
  const apiKey = getApiKey();

  // OpenAI allows up to 2048 inputs per request
  const batchSize = 2048;
  const allEmbeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(`${OPENAI_API_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as OpenAIError;
      throw new Error(`OpenAI API error: ${error.error.message}`);
    }

    const data = (await response.json()) as EmbeddingResponse;

    // Sort by index to maintain order
    const sortedData = data.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sortedData.map((d) => d.embedding));
    totalTokens += data.usage.total_tokens;
  }

  return { embeddings: allEmbeddings, tokens: totalTokens };
}

/**
 * Chat completion with optional function calling
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: {
    functions?: FunctionDefinition[];
    function_call?: "auto" | "none" | { name: string };
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<{
  message: ChatMessage;
  usage: { prompt_tokens: number; completion_tokens: number };
}> {
  const apiKey = getApiKey();

  const body: Record<string, unknown> = {
    model: CHAT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4096,
  };

  if (options.functions) {
    body.functions = options.functions;
    body.function_call = options.function_call ?? "auto";
  }

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json()) as OpenAIError;
    throw new Error(`OpenAI API error: ${error.error.message}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;

  return {
    message: data.choices[0].message,
    usage: {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
    },
  };
}

/**
 * Format embedding as PostgreSQL vector literal
 */
export function formatPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * SQL functions available for AI to call when chatting with data
 */
export const dataQueryFunctions: FunctionDefinition[] = [
  {
    name: "query_leads",
    description:
      "Query leads from the database with filters. Returns lead data including source, status, and attribution.",
    parameters: {
      type: "object",
      properties: {
        organization_id: {
          type: "string",
          description: "Filter by organization UUID",
        },
        lead_source: {
          type: "string",
          description:
            "Filter by lead source slug (e.g., 'zillow', 'realtor_com')",
        },
        match_status: {
          type: "string",
          enum: ["pending", "matched", "unmatched", "multiple", "review"],
          description: "Filter by match status",
        },
        date_from: {
          type: "string",
          description: "Start date filter (ISO format)",
        },
        date_to: {
          type: "string",
          description: "End date filter (ISO format)",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default 100)",
        },
      },
      required: ["organization_id"],
    },
  },
  {
    name: "get_source_summary",
    description:
      "Get summary statistics for lead sources including total leads, match rates, and date ranges.",
    parameters: {
      type: "object",
      properties: {
        organization_id: {
          type: "string",
          description: "Organization UUID",
        },
      },
      required: ["organization_id"],
    },
  },
  {
    name: "get_team_summary",
    description:
      "Get summary statistics for teams including attributed leads and agent counts.",
    parameters: {
      type: "object",
      properties: {
        organization_id: {
          type: "string",
          description: "Organization UUID",
        },
      },
      required: ["organization_id"],
    },
  },
  {
    name: "semantic_search_leads",
    description:
      "Search leads using natural language. Uses vector similarity to find relevant leads.",
    parameters: {
      type: "object",
      properties: {
        organization_id: {
          type: "string",
          description: "Organization UUID",
        },
        query: {
          type: "string",
          description: "Natural language search query",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default 10)",
        },
      },
      required: ["organization_id", "query"],
    },
  },
];
