import { request } from "./client";
import type {
  AuditEntry,
  AuditFilters,
  AuthUser,
  Budget,
  BureauCheckResponse,
  CreateRequestPayload,
  CreditRequest,
  RequestStatus,
  TransitionResult,
} from "./types";

export const authApi = {
  users: (): Promise<AuthUser[]> =>
    request<{ users: AuthUser[] }>("/auth/users").then((res) => res.users),
  login: (userId: string): Promise<{ token: string; user: AuthUser }> =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { userId },
    }),
  me: (): Promise<AuthUser> =>
    request<{ user: AuthUser }>("/auth/me").then((res) => res.user),
};

export const requestsApi = {
  list: (status?: RequestStatus): Promise<CreditRequest[]> =>
    request<{ requests: CreditRequest[] }>(
      status ? `/requests?status=${encodeURIComponent(status)}` : "/requests",
    ).then((res) => res.requests),

  get: (id: number): Promise<CreditRequest> =>
    request<{ request: CreditRequest }>(`/requests/${id}`).then(
      (res) => res.request,
    ),

  create: (payload: CreateRequestPayload): Promise<CreditRequest> =>
    request<{ request: CreditRequest }>("/requests", {
      method: "POST",
      body: payload,
    }).then((res) => res.request),

  startReview: (id: number): Promise<TransitionResult> =>
    request<TransitionResult>(`/requests/${id}/start-review`, {
      method: "POST",
      body: {},
    }),

  approve: (id: number): Promise<TransitionResult> =>
    request<TransitionResult>(`/requests/${id}/approve`, {
      method: "POST",
      body: {},
    }),

  reject: (id: number, comment: string): Promise<TransitionResult> =>
    request<TransitionResult>(`/requests/${id}/reject`, {
      method: "POST",
      body: { comment },
    }),

  bureauCheck: (id: number): Promise<BureauCheckResponse> =>
    request<BureauCheckResponse>(`/requests/${id}/bureau-check`, {
      method: "POST",
      body: {},
    }),
};

export const budgetApi = {
  get: (): Promise<Budget> => request<Budget>("/budget"),
};

export const auditApi = {
  list: (filters: AuditFilters): Promise<AuditEntry[]> => {
    const params = new URLSearchParams();
    if (filters.requestId !== undefined) {
      params.set("requestId", String(filters.requestId));
    }
    if (filters.limit !== undefined) {
      params.set("limit", String(filters.limit));
    }
    const query = params.toString();
    return request<{ entries: AuditEntry[] }>(
      `/audit${query ? `?${query}` : ""}`,
    ).then((res) => res.entries);
  },
};
