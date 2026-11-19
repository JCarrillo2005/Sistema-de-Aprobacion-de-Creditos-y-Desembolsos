import type { CreditRequest } from "../api/types";
import { useBureauCheck, useBureauState } from "../api/hooks";
import { formatDateTime } from "../lib/format";

export function BureauPanel({ request }: { request: CreditRequest }) {
  const bureau = useBureauCheck();
  const { pending, error } = useBureauState(request.id);

  const hasResult = request.bureauScore !== null && request.bureauRisk !== null;

  return (
    <section className="card" aria-label="Buró crediticio">
      <div className="card-header">
        <h3>Buró crediticio</h3>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => bureau.mutate(request.id)}
        >
          {hasResult ? "Volver a consultar" : "Consultar buró"}
        </button>
      </div>

      {pending && (
        <div className="alert alert-info" role="status">
          <span className="spinner" aria-hidden="true" />
          Consultando el buró crediticio… El servicio externo puede tardar o
          fallar; se reintenta automáticamente con espera progresiva. Puedes
          seguir navegando.
        </div>
      )}

      {!pending && error && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      {hasResult &&
      request.bureauScore !== null &&
      request.bureauRisk !== null ? (
        <dl className="summary">
          <div>
            <dt>Puntaje</dt>
            <dd>{request.bureauScore}</dd>
          </div>
          <div>
            <dt>Riesgo</dt>
            <dd>
              <span className={`risk risk-${request.bureauRisk.toLowerCase()}`}>
                {request.bureauRisk}
              </span>
            </dd>
          </div>
          <div>
            <dt>Última consulta</dt>
            <dd>
              {request.bureauCheckedAt
                ? formatDateTime(request.bureauCheckedAt)
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        !pending &&
        !error && (
          <p className="muted">
            Aún no se ha consultado el buró para esta solicitud.
          </p>
        )
      )}
    </section>
  );
}
