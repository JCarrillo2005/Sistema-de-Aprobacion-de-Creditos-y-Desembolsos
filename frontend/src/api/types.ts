export type Role = "SOLICITANTE" | "ANALISTA";

export type RequestStatus = "CREADA" | "EN_REVISION" | "APROBADA" | "RECHAZADA";

export const REQUEST_STATUSES: readonly RequestStatus[] = [
  "CREADA",
  "EN_REVISION",
  "APROBADA",
  "RECHAZADA",
];

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

export interface CreditRequest {
  id: number;
  applicantId: string;
  applicantName: string;
  documentId: string;
  monthlyIncome: number;
  amount: number;
  termMonths: number;
  status: RequestStatus;
  rejectionReason: string | null;
  bureauScore: number | null;
  bureauRisk: string | null;
  bureauCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: number;
  requestId: number;
  actorId: string;
  actorName: string;
  actorRole: Role;
  occurredAt: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
}

export interface CreateRequestPayload {
  applicantName: string;
  documentId: string;
  monthlyIncome: number;
  amount: number;
  termMonths: number;
}

export interface TransitionResult {
  request: CreditRequest;
  idempotent: boolean;
}

export interface BureauResult {
  documentId: string;
  score: number;
  risk: "BAJO" | "MEDIO" | "ALTO";
  attempts: number;
}

export interface BureauCheckResponse {
  request: CreditRequest;
  bureau: BureauResult;
}

export interface Budget {
  available: number;
  initial: number;
}

export interface AuditFilters {
  requestId?: number;
  limit?: number;
}
