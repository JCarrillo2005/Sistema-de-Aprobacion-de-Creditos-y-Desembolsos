import type { RequestStatus } from "../api/types";
import { StatusCode } from "./StatusBadge";

interface Props {
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
}

// Par de estados en formato bitácora: ORIGEN → DESTINO.
export function TransitionBadge({ fromStatus, toStatus }: Props) {
  return (
    <span className="transition-badge">
      {fromStatus ? (
        <StatusCode status={fromStatus} />
      ) : (
        <span className="status-code status-code--origin">Alta</span>
      )}
      <span className="transition-arrow" aria-hidden="true">
        →
      </span>
      <StatusCode status={toStatus} />
    </span>
  );
}
