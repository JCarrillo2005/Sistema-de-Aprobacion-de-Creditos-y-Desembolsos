import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useApprove,
  useAudit,
  useBureauCheck,
  useBudget,
  useReject,
  useRequest,
  useStartReview,
} from "../api/hooks";
import type { CreditRequest } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { AmortizationTable } from "../components/AmortizationTable";
import { BureauPanel } from "../components/BureauPanel";
import { LifecycleStepper } from "../components/LifecycleStepper";
import { StatusBadge } from "../components/StatusBadge";
import { TransitionBadge } from "../components/TransitionBadge";
import { formatDateTime, formatMoney, formatPercent } from "../lib/format";
import {
  debtRatioPercent,
  MIN_REJECTION_REASON_LENGTH,
} from "../lib/rules";

function Info({
  label,
  children,
  numeric = false,
}: {
  label: string;
  children: ReactNode;
  numeric?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={numeric ? "mono" : undefined}>{children}</dd>
    </div>
  );
}

function RejectionNotice({ reason }: { reason: string }) {
  return (
    <section className="alert alert-rejection" role="note" aria-label="Motivo oficial del rechazo">
      <div className="alert-title">
        <strong>Motivo oficial del analista</strong>
        <span className="immutable-badge mono">REGISTRO AUDITADO</span>
      </div>
      <blockquote className="rejection-quote">{reason}</blockquote>
      <p className="alert-footnote">
        Una solicitud rechazada bloquea nuevas solicitudes con este documento
        durante 30 días desde su fecha de creación.
      </p>
    </section>
  );
}

function ReviewActions({ request }: { request: CreditRequest }) {
  const startReview = useStartReview();
  const approve = useApprove();
  const reject = useReject();
  const bureau = useBureauCheck();
  const budget = useBudget(5000);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const busy = startReview.isPending || approve.isPending || reject.isPending;
  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= MIN_REJECTION_REASON_LENGTH;
  const ratio = debtRatioPercent(request.amount, request.monthlyIncome);
  const insufficient =
    budget.data !== undefined && request.amount > budget.data.available;

  function begin() {
    setNotice(null);
    setActionError(null);
  }

  function handleStartReview() {
    begin();
    startReview.mutate(request.id, {
      onSuccess: () => {
        setNotice("La solicitud quedó en revisión.");
        if (request.bureauScore === null) {
          bureau.mutate(request.id);
        }
      },
      onError: (error) => setActionError(error.message),
    });
  }

  function handleApprove() {
    begin();
    approve.mutate(request.id, {
      onSuccess: (result) =>
        setNotice(
          result.idempotent
            ? "Ya estaba aprobada: no se descontó el presupuesto dos veces."
            : "Solicitud aprobada y presupuesto descontado.",
        ),
      onError: (error) => setActionError(error.message),
    });
  }

  function handleReject() {
    if (!reasonValid) {
      return;
    }
    begin();
    reject.mutate(
      { id: request.id, comment: reason.trim() },
      {
        onSuccess: () => {
          setNotice("Solicitud rechazada y motivo registrado en auditoría.");
          setRejecting(false);
          setReason("");
        },
        onError: (error) => setActionError(error.message),
      },
    );
  }

  const isFinal =
    request.status === "APROBADA" || request.status === "RECHAZADA";

  return (
    <section className="panel decision" aria-label="Zona de dictamen">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Acción del analista</span>
          <h3>Zona de dictamen</h3>
        </div>
        <span className="immutable-badge mono">AUDITADO</span>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      {isFinal && (
        <div className="decision-final">
          <StatusBadge status={request.status} />
          <p>
            Estado final. La transición quedó registrada y no admite
            reversiones.
          </p>
        </div>
      )}

      {request.status === "CREADA" && (
        <>
          <p className="decision-copy">
            La solicitud está sin tomar. Al iniciar la revisión se registra la
            transición <span className="mono">CREADA → EN_REVISION</span>.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy}
            aria-busy={startReview.isPending}
            onClick={handleStartReview}
          >
            {startReview.isPending ? "Procesando…" : "Tomar para revisión"}
          </button>
        </>
      )}

      {request.status === "EN_REVISION" && (
        <>
          <dl className="decision-facts">
            <div>
              <dt>Compromiso</dt>
              <dd className="mono">{formatMoney(request.amount)}</dd>
            </div>
            <div>
              <dt>Endeudamiento</dt>
              <dd className="mono">{ratio !== null ? formatPercent(ratio) : "—"}</dd>
            </div>
            <div>
              <dt>Disponible</dt>
              <dd className="mono">
                {budget.data ? formatMoney(budget.data.available) : "—"}
              </dd>
            </div>
          </dl>

          {insufficient && budget.data && (
            <div className="alert alert-warning alert-contained" id="decision-budget-warning" role="alert">
              <div className="alert-title">
                <strong>Presupuesto insuficiente</strong>
                <code className="mono">HTTP 422</code>
              </div>
              <p>
                Solicitado <span className="mono">{formatMoney(request.amount)}</span>{" "}
                · disponible{" "}
                <span className="mono">{formatMoney(budget.data.available)}</span>.
                La aprobación fallará y la solicitud permanecerá en revisión.
              </p>
            </div>
          )}

          {!rejecting ? (
            <div className="decision-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                aria-busy={approve.isPending}
                aria-describedby={insufficient ? "decision-budget-warning" : undefined}
                onClick={handleApprove}
              >
                {approve.isPending
                  ? "Aprobando…"
                  : `Aprobar ${formatMoney(request.amount)}`}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => {
                  begin();
                  setRejecting(true);
                }}
              >
                Rechazar
              </button>
            </div>
          ) : (
            <div className="reject-form">
              <label htmlFor="rejectReason">
                Motivo oficial del rechazo
              </label>
              <textarea
                id="rejectReason"
                rows={4}
                maxLength={500}
                value={reason}
                aria-describedby="reject-counter"
                placeholder="Explica el motivo con claridad: quedará en la bitácora y será visible para el solicitante."
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="counter-row">
                <span
                  id="reject-counter"
                  className={reasonValid ? "counter-valid mono" : "counter-invalid mono"}
                  aria-live="polite"
                >
                  {reasonLength} / {MIN_REJECTION_REASON_LENGTH} caracteres mínimos
                </span>
                <span className="mono muted">{reason.trim().length} / 500</span>
              </div>
              <div className="decision-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy || !reasonValid}
                  aria-busy={reject.isPending}
                  onClick={handleReject}
                >
                  {reject.isPending ? "Rechazando…" : "Confirmar rechazo"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setRejecting(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RequestHistory({ requestId }: { requestId: number }) {
  const audit = useAudit({ requestId, limit: 50 }, { refetchInterval: 3000 });

  return (
    <section className="panel" aria-label="Historial de la solicitud">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Trazabilidad</span>
          <h3>Historial de auditoría</h3>
        </div>
        <span className="sync-tag mono">SYNC 3s</span>
      </div>
      {audit.isLoading && (
        <div className="page-state" role="status">
          <span className="spinner" aria-hidden="true" /> Cargando historial…
        </div>
      )}
      {audit.isError && (
        <div className="alert alert-error" role="alert">
          {audit.error.message}
        </div>
      )}
      {audit.data && (
        <div className="table-scroll">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Actor</th>
                <th>Transición</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <time dateTime={entry.occurredAt} title={entry.occurredAt}>
                      {formatDateTime(entry.occurredAt)}
                    </time>
                  </td>
                  <td>
                    <span className="table-primary">{entry.actorName}</span>
                    <span className="table-sub mono">
                      {entry.actorId} · {entry.actorRole}
                    </span>
                  </td>
                  <td>
                    <TransitionBadge
                      fromStatus={entry.fromStatus}
                      toStatus={entry.toStatus}
                    />
                  </td>
                  <td className="comment-cell" title={entry.comment ?? ""}>
                    {entry.comment ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function RequestDetailPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const validId = Number.isInteger(id) && id > 0;
  const { user } = useAuth();
  const requestQuery = useRequest(id, validId, 5000);

  if (!validId) {
    return (
      <div className="alert alert-error" role="alert">
        Identificador de solicitud inválido.
      </div>
    );
  }
  if (requestQuery.isLoading) {
    return (
      <div className="page-state" role="status">
        <span className="spinner" aria-hidden="true" /> Cargando solicitud…
      </div>
    );
  }
  if (requestQuery.isError) {
    return (
      <>
        <div className="alert alert-error" role="alert">
          {requestQuery.error.message}
        </div>
        <Link to="/" className="table-link">
          Volver al inicio →
        </Link>
      </>
    );
  }

  const request = requestQuery.data;
  if (!request || !user) {
    return null;
  }

  const isAnalyst = user.role === "ANALISTA";
  const ratio = debtRatioPercent(request.amount, request.monthlyIncome);

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Expediente · solicitud</span>
          <h2>
            <span className="mono">#{request.id}</span>{" "}
            <StatusBadge status={request.status} />
          </h2>
        </div>
        <Link className="back-link" to={isAnalyst ? "/analyst" : "/requests"}>
          ← Volver al listado
        </Link>
      </div>

      <section className="panel request-overview" aria-label="Datos de la solicitud">
        <div className="overview-head">
          <div>
            <span className="eyebrow">Ciclo de vida</span>
            <h3>{request.applicantName}</h3>
            <p className="mono muted">{request.documentId}</p>
          </div>
          <span className="immutable-badge mono">SOLO LECTURA</span>
        </div>

        <LifecycleStepper status={request.status} />

        <dl className="summary summary-wide">
          <Info label="Ingreso mensual" numeric>
            {formatMoney(request.monthlyIncome)}
          </Info>
          <Info label="Monto solicitado" numeric>
            {formatMoney(request.amount)}
          </Info>
          <Info label="Endeudamiento" numeric>
            {ratio !== null ? formatPercent(ratio) : "—"}
          </Info>
          <Info label="Plazo" numeric>
            {request.termMonths} meses
          </Info>
          <Info label="Creada" numeric>
            <time dateTime={request.createdAt} title={request.createdAt}>
              {formatDateTime(request.createdAt)}
            </time>
          </Info>
          <Info label="Actualizada" numeric>
            <time dateTime={request.updatedAt} title={request.updatedAt}>
              {formatDateTime(request.updatedAt)}
            </time>
          </Info>
        </dl>
      </section>

      {request.status === "RECHAZADA" && request.rejectionReason && (
        <RejectionNotice reason={request.rejectionReason} />
      )}

      <div className="detail-grid">
        <div className="detail-main">
          <AmortizationTable principal={request.amount} termMonths={request.termMonths} />
          {isAnalyst && <RequestHistory requestId={request.id} />}
        </div>

        <div className="detail-side">
          <BureauPanel request={request} />
          {isAnalyst && <ReviewActions request={request} />}
          {!isAnalyst && (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Seguimiento</span>
                  <h3>Estado de la evaluación</h3>
                </div>
              </div>
              <p className="muted">
                Un analista revisará la solicitud y registrará cada transición
                en la bitácora inmutable. El resultado se reflejará aquí
                automáticamente.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
