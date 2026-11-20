export type Role = "SOLICITANTE" | "ANALISTA";

export type RequestStatus = "CREADA" | "EN_REVISION" | "APROBADA" | "RECHAZADA";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
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
  actorEmail: string | null;
  actorRole: Role;
  occurredAt: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  comment: string | null;
}
