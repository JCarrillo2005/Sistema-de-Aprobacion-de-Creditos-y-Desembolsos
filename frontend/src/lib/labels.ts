import type { RequestStatus, Role } from "../api/types";

// Etiquetas visibles. Los códigos del dominio se conservan en el backend y en
// los tooltips para trazabilidad técnica, pero la interfaz habla en lenguaje
// operativo.
export const STATUS_LABELS: Record<RequestStatus, string> = {
  CREADA: "Recibida",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

export const ROLE_LABELS: Record<Role, string> = {
  SOLICITANTE: "Solicitante",
  ANALISTA: "Analista",
};

export function statusLabel(status: RequestStatus): string {
  return STATUS_LABELS[status];
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Iniciales para el avatar de la cuenta. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
