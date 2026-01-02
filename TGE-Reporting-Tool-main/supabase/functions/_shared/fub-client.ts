/**
 * Follow Up Boss API client
 */

const FUB_BASE_URL = "https://api.followupboss.com/v1";

interface FubApiError {
  error: string;
  message: string;
}

interface FubPerson {
  id: number;
  created: string;
  updated: string;
  firstName: string;
  lastName: string;
  stage: string;
  source: string;
  sourceUrl?: string;
  contacted: boolean;
  price?: number;
  emails: Array<{ value: string; type: string }>;
  phones: Array<{ value: string; type: string }>;
  addresses: Array<{
    street: string;
    city: string;
    state: string;
    code: string;
    country: string;
    type: string;
  }>;
  tags: string[];
  assignedTo?: number;
  assignedUserId?: number;
  collaborators?: number[];
  deals?: Array<{
    id: number;
    name: string;
    stage: string;
  }>;
}

interface FubUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface FubPaginatedResponse<T> {
  _metadata: {
    collection: string;
    offset: number;
    limit: number;
    total: number;
  };
  [key: string]: T[] | FubPaginatedResponse<T>["_metadata"];
}

export interface FubClientConfig {
  apiKey: string;
}

/**
 * Follow Up Boss API client
 */
export class FubClient {
  private apiKey: string;

  constructor(config: FubClientConfig) {
    this.apiKey = config.apiKey;
  }

  /**
   * Make an authenticated request to the FUB API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${FUB_BASE_URL}${endpoint}`;
    const auth = btoa(`${this.apiKey}:`);

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as FubApiError;
      throw new Error(`FUB API error: ${error.message || error.error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get all people (leads) with pagination
   * Reference: https://docs.followupboss.com/reference/people-get
   */
  async getPeople(params: {
    offset?: number;
    limit?: number;
    sort?: string;
    updatedAfter?: string;
    lastActivityAfter?: string;
    lastActivityBefore?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    stage?: string;
    source?: string;
    assignedTo?: string;
    assignedUserId?: number;
    assignedPondId?: number;
    assignedLenderName?: string;
    assignedLenderId?: number;
    contacted?: boolean;
    priceAbove?: number;
    priceBelow?: number;
    smartListId?: number;
    includeTrash?: boolean;
    includeUnclaimed?: boolean;
    tags?: string;
    fields?: string;
  } = {}): Promise<{ people: FubPerson[]; total: number; hasMore: boolean }> {
    const searchParams = new URLSearchParams();

    // Pagination
    if (params.offset !== undefined) searchParams.set("offset", params.offset.toString());
    if (params.limit !== undefined) searchParams.set("limit", params.limit.toString());
    
    // Sorting
    if (params.sort) searchParams.set("sort", params.sort);
    
    // Time filters
    if (params.updatedAfter) searchParams.set("updatedAfter", params.updatedAfter);
    if (params.lastActivityAfter) searchParams.set("lastActivityAfter", params.lastActivityAfter);
    if (params.lastActivityBefore) searchParams.set("lastActivityBefore", params.lastActivityBefore);
    
    // Name filters
    if (params.name) searchParams.set("name", params.name);
    if (params.firstName) searchParams.set("firstName", params.firstName);
    if (params.lastName) searchParams.set("lastName", params.lastName);
    
    // Contact filters
    if (params.email) searchParams.set("email", params.email);
    if (params.phone) searchParams.set("phone", params.phone);
    
    // Status filters
    if (params.stage) searchParams.set("stage", params.stage);
    if (params.source) searchParams.set("source", params.source);
    
    // Assignment filters
    if (params.assignedTo) searchParams.set("assignedTo", params.assignedTo);
    if (params.assignedUserId !== undefined) searchParams.set("assignedUserId", params.assignedUserId.toString());
    if (params.assignedPondId !== undefined) searchParams.set("assignedPondId", params.assignedPondId.toString());
    if (params.assignedLenderName) searchParams.set("assignedLenderName", params.assignedLenderName);
    if (params.assignedLenderId !== undefined) searchParams.set("assignedLenderId", params.assignedLenderId.toString());
    
    // Activity filters
    if (params.contacted !== undefined) searchParams.set("contacted", params.contacted.toString());
    if (params.priceAbove !== undefined) searchParams.set("priceAbove", params.priceAbove.toString());
    if (params.priceBelow !== undefined) searchParams.set("priceBelow", params.priceBelow.toString());
    
    // Smart list filter
    if (params.smartListId !== undefined) searchParams.set("smartListId", params.smartListId.toString());
    
    // Include filters
    if (params.includeTrash !== undefined) searchParams.set("includeTrash", params.includeTrash.toString());
    if (params.includeUnclaimed !== undefined) searchParams.set("includeUnclaimed", params.includeUnclaimed.toString());
    
    // Tag filters
    if (params.tags) searchParams.set("tags", params.tags);
    
    // Field selector
    if (params.fields) searchParams.set("fields", params.fields);

    const query = searchParams.toString();
    const endpoint = `/people${query ? `?${query}` : ""}`;

    const response = await this.request<FubPaginatedResponse<FubPerson>>(endpoint);

    const people = (response.people || []) as FubPerson[];
    const metadata = response._metadata;

    return {
      people,
      total: metadata.total,
      hasMore: metadata.offset + people.length < metadata.total,
    };
  }

  /**
   * Get a single person by ID
   */
  async getPerson(id: number): Promise<FubPerson> {
    return this.request<FubPerson>(`/people/${id}`);
  }

  /**
   * Get all users in the account
   */
  async getUsers(): Promise<FubUser[]> {
    const response = await this.request<FubPaginatedResponse<FubUser>>("/users");
    return (response.users || []) as FubUser[];
  }

  /**
   * Get a single user by ID
   */
  async getUser(id: number): Promise<FubUser> {
    return this.request<FubUser>(`/users/${id}`);
  }

  /**
   * Iterate through all people with automatic pagination
   */
  async *iteratePeople(params: {
    batchSize?: number;
    updatedAfter?: string;
  } = {}): AsyncGenerator<FubPerson[], void, unknown> {
    const batchSize = params.batchSize || 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getPeople({
        offset,
        limit: batchSize,
        updatedAfter: params.updatedAfter,
      });

      if (result.people.length > 0) {
        yield result.people;
      }

      hasMore = result.hasMore;
      offset += batchSize;
    }
  }

  /**
   * Get account info to verify API key
   */
  async verifyConnection(): Promise<{ valid: boolean; accountName?: string }> {
    try {
      const users = await this.getUsers();
      return {
        valid: true,
        accountName: users.length > 0 ? `${users.length} users` : undefined,
      };
    } catch {
      return { valid: false };
    }
  }
}

/**
 * Transform FUB person to our FubLead format
 */
export function transformFubPerson(
  person: FubPerson,
  connectionId: string,
  organizationId: string,
  usersMap: Map<number, FubUser>
): {
  fub_connection_id: string;
  organization_id: string;
  fub_lead_id: number;
  fub_person_id: number;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  assigned_user_id: number | null;
  assigned_user_email: string | null;
  assigned_user_name: string | null;
  fub_source: string | null;
  fub_source_url: string | null;
  fub_stage: string | null;
  fub_tags: string[];
  fub_created_at: string;
  fub_updated_at: string;
  raw_data: Record<string, unknown>;
  sync_hash: string;
} {
  const primaryEmail = person.emails?.[0]?.value || null;
  const primaryPhone = person.phones?.[0]?.value || null;
  const primaryAddress = person.addresses?.[0];

  const assignedUserId = person.assignedUserId || person.assignedTo || null;
  const assignedUser = assignedUserId ? usersMap.get(assignedUserId) : undefined;

  // Create a hash for change detection
  const hashData = JSON.stringify({
    email: primaryEmail,
    phone: primaryPhone,
    firstName: person.firstName,
    lastName: person.lastName,
    stage: person.stage,
    assignedTo: assignedUserId,
    updated: person.updated,
  });
  const syncHash = btoa(hashData).slice(0, 32);

  return {
    fub_connection_id: connectionId,
    organization_id: organizationId,
    fub_lead_id: person.id,
    fub_person_id: person.id,
    email: primaryEmail,
    phone: primaryPhone,
    first_name: person.firstName || null,
    last_name: person.lastName || null,
    address: primaryAddress?.street || null,
    city: primaryAddress?.city || null,
    state: primaryAddress?.state || null,
    zip: primaryAddress?.code || null,
    assigned_user_id: assignedUserId,
    assigned_user_email: assignedUser?.email || null,
    assigned_user_name: assignedUser?.name || null,
    fub_source: person.source || null,
    fub_source_url: person.sourceUrl || null,
    fub_stage: person.stage || null,
    fub_tags: person.tags || [],
    fub_created_at: person.created,
    fub_updated_at: person.updated,
    raw_data: person as unknown as Record<string, unknown>,
    sync_hash: syncHash,
  };
}
