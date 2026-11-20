import type { RequestStatus } from "../api/types";
import { statusLabel } from "../lib/labels";

// Semántica única de estados. El título conserva el código del dominio para
// trazabilidad; la etiqueta visible usa lenguaje operativo.
export function StatusBadge({ status }: { status: RequestStatus }) {
  const modifier = status.toLowerCase().replace("_", "-");
  return (
    <span
      className={`status-badge status-badge--${modifier}`}
      title={`Estado: ${statusLabel(status)} (${status})`}
    >
      <span className="status-dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export function StatusCode({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`status-code status-code--${status.toLowerCase().replace("_", "-")}`}
      title={`Código interno: ${status}`}
    >
      {statusLabel(status)}
    </span>
  );
}
