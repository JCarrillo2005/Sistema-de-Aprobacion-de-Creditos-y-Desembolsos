import type { RequestStatus } from "../api/types";

const LABELS: Record<RequestStatus, string> = {
  CREADA: "Creada",
  EN_REVISION: "En revisión",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

// Semántica única de estados. El título expone el código exacto del dominio,
// útil en tablas densas y para lectores de pantalla.
export function StatusBadge({ status }: { status: RequestStatus }) {
  const modifier = status.toLowerCase().replace("_", "-");
  return (
    <span
      className={`status-badge status-badge--${modifier}`}
      title={`Estado: ${status}`}
    >
      <span className="status-dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

export function StatusCode({ status }: { status: RequestStatus }) {
  return <span className={`status-code status-code--${status.toLowerCase().replace("_", "-")}`}>{status}</span>;
}
