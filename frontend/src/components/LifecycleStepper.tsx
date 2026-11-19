import type { RequestStatus } from "../api/types";

interface Props {
  status: RequestStatus;
  compact?: boolean;
}

function stepIndex(status: RequestStatus): number {
  if (status === "CREADA") {
    return 0;
  }
  if (status === "EN_REVISION") {
    return 1;
  }
  return 2;
}

// Ciclo permitido: CREADA → EN_REVISION → APROBADA | RECHAZADA.
// No hay reversiones: el último nodo se colorea según el desenlace.
export function LifecycleStepper({ status, compact = false }: Props) {
  const finalLabel = status === "RECHAZADA" ? "Rechazada" : "Aprobada";
  const labels = ["Creada", "En revisión", finalLabel];
  const current = stepIndex(status);
  const outcome =
    status === "RECHAZADA" ? "rejected" : status === "APROBADA" ? "approved" : "open";

  if (compact) {
    return (
      <span
        className={`lifecycle-compact lifecycle-compact--${outcome}`}
        title={`Ciclo: ${labels[current]} (${current + 1}/3)`}
        aria-label={`Progreso del ciclo: ${labels[current]}, paso ${current + 1} de 3`}
      >
        {labels.map((label, index) => (
          <span
            key={label}
            className={`lifecycle-dot${index <= current ? " reached" : ""}${index === current ? " current" : ""}`}
            aria-hidden="true"
          />
        ))}
      </span>
    );
  }

  return (
    <ol className={`lifecycle lifecycle--${outcome}`} aria-label="Ciclo de vida de la solicitud">
      {labels.map((label, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "pending";
        return (
          <li key={label} className={`lifecycle-step lifecycle-step--${state}`}>
            <span className="lifecycle-marker" aria-hidden="true">
              {index < current ? "✓" : `0${index + 1}`}
            </span>
            <span className="lifecycle-copy">
              <span className="lifecycle-label">{label}</span>
              <span className="lifecycle-caption mono">
                {index < current ? "completado" : index === current ? "estado actual" : "pendiente"}
              </span>
            </span>
            {index < labels.length - 1 && (
              <span className="lifecycle-connector" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
