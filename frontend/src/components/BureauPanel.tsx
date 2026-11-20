import { useBureauCheck, useBureauState } from "../api/hooks";
import type { CreditRequest } from "../api/types";
import { formatDateTime } from "../lib/format";

type Risk = "BAJO" | "MEDIO" | "ALTO";

function normalizeRisk(value: string | null): Risk | null {
  return value === "BAJO" || value === "MEDIO" || value === "ALTO"
    ? value
    : null;
}

function scorePosition(score: number): number {
  const clamped = Math.min(850, Math.max(300, score));
  return ((clamped - 300) / 550) * 100;
}

export function BureauPanel({ request }: { request: CreditRequest }) {
  const bureau = useBureauCheck();
  const { pending, error } = useBureauState(request.id);
  const risk = normalizeRisk(request.bureauRisk);
  const hasResult = request.bureauScore !== null && risk !== null;

  return (
    <section className="panel bureau" aria-label="Buró crediticio">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Consulta externa</span>
          <h3>Buró de crédito</h3>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={pending}
          aria-busy={pending}
          onClick={() => bureau.mutate(request.id)}
        >
          {hasResult ? "Reconsultar" : "Consultar"}
        </button>
      </div>

      {pending && (
        <div className="bureau-loading" role="status" aria-live="polite">
          <div className="skeleton skeleton--label" />
          <div className="skeleton skeleton--value" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
          <p className="bureau-loading-note">
            <span className="spinner" aria-hidden="true" />
            Consultando el buró de crédito. Si la respuesta tarda,
            reintentaremos automáticamente. Puedes seguir navegando.
          </p>
        </div>
      )}

      {!pending && error && (
        <div className="alert alert-error alert-contained" role="alert">
          <div className="alert-title">
            <strong>Consulta no disponible</strong>
          </div>
          <p>{error.message}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => bureau.mutate(request.id)}
          >
            Reintentar
          </button>
          <p className="alert-footnote">
            La consulta es informativa y no condiciona el dictamen.
          </p>
        </div>
      )}

      {hasResult && request.bureauScore !== null && risk !== null && (
        <div className="bureau-result">
          <div className="score-head">
            <span className="eyebrow">Puntaje crediticio</span>
            <strong className="score-value mono">{request.bureauScore}</strong>
          </div>
          <div className="score-track" aria-hidden="true">
            <span className="score-marker" style={{ left: `${scorePosition(request.bureauScore)}%` }} />
          </div>
          <div className="score-scale mono">
            <span>300</span>
            <span>580</span>
            <span>850</span>
          </div>
          <dl className="bureau-meta">
            <div>
              <dt>Nivel de riesgo</dt>
              <dd>
                <span className={`risk risk-${risk.toLowerCase()}`}>{risk}</span>
              </dd>
            </div>
            <div>
              <dt>Documento consultado</dt>
              <dd className="mono">{request.documentId}</dd>
            </div>
            <div>
              <dt>Fuente</dt>
              <dd>Buró de crédito</dd>
            </div>
            <div>
              <dt>Última consulta</dt>
              <dd>
                {request.bureauCheckedAt ? (
                  <time
                    className="mono"
                    dateTime={request.bureauCheckedAt}
                    title={request.bureauCheckedAt}
                  >
                    {formatDateTime(request.bureauCheckedAt)}
                  </time>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!hasResult && !pending && !error && (
        <div className="bureau-idle">
          <p className="mono">{request.documentId}</p>
          <p>
            Aún no se ha consultado el buró para esta solicitud. La consulta es
            informativa y no condiciona el dictamen.
          </p>
        </div>
      )}
    </section>
  );
}
