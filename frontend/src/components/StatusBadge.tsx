import type { RequestStatus } from "../api/types";

const LABELS: Record<RequestStatus, string> = {
  CREADA: "Creada",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const modifier = status.toLowerCase().replace("_", "-");
  return <span className={`badge badge-${modifier}`}>{LABELS[status]}</span>;
}
