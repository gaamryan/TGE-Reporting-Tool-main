/**
 * Shared Types
 */

export * from "./widget";
export * from "./chat";

/** Organization */
export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  settings: Record<string, unknown>;
  status: "active" | "inactive" | "churned";
  createdAt: string;
  updatedAt: string;
}

/** Team */
export interface Team {
  id: string;
  organizationId: string;
  name: string;
  externalId?: string;
  settings: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Agent */
export interface Agent {
  id: string;
  teamId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  fubUserId?: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Lead Source */
export interface LeadSource {
  id: string;
  slug: string;
  displayName: string;
  isActive: boolean;
}

/** Source Lead (from CSV imports) */
export interface SourceLead {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  propertyAddress?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  leadType?: string;
  sourceCreatedAt?: string;
  matchStatus: "pending" | "matched" | "unmatched" | "multiple" | "review";
  matchConfidence?: number;
  leadSource?: string;
  createdAt: string;
}

/** FUB Lead (from Follow Up Boss) */
export interface FubLead {
  id: string;
  fubLeadId: number;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  assignedUserName?: string;
  fubSource?: string;
  fubStage?: string;
  fubCreatedAt?: string;
}

/** Lead Match */
export interface LeadMatch {
  id: string;
  sourceLeadId: string;
  fubLeadId: string;
  matchType: string;
  matchConfidence: number;
  matchedBy: "system" | "ai" | "manual";
  status: "active" | "disputed" | "invalidated";
  attributedTeamId?: string;
  attributedAgentId?: string;
  createdAt: string;
}

/** Match Candidate (for review) */
export interface MatchCandidate {
  id: string;
  sourceLeadId: string;
  fubLeadId: string;
  confidenceScore: number;
  matchReasons: {
    type: string;
    field: string;
    score: number;
    details?: string;
  }[];
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: string;
  expiresAt: string;
}

/** AI Insight */
export interface AIInsight {
  id: string;
  insightType: string;
  title: string;
  summary: string;
  details?: Record<string, unknown>;
  periodStart?: string;
  periodEnd?: string;
  isRead: boolean;
  isActionable: boolean;
  createdAt: string;
}

/** User context for the app */
export interface UserContext {
  user: {
    id: string;
    email: string;
  } | null;
  organization: Organization | null;
  teams: Team[];
  isLoading: boolean;
}
