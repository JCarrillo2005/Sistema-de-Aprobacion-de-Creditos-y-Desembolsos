import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useApprove,
  useAudit,
  useBureauCheck,
  useReject,
  useRequest,
  useStartReview,
} from "../api/hooks";
import type { CreditRequest } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { AmortizationTable } from "../components/AmortizationTable";
import { BureauPanel } from "../components/BureauPanel";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatMoney } from "../lib/format";
import { MIN_REJECTION_REASON_LENGTH } from "../lib/rules";

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ReviewActions({ request }: { request: CreditRequest }) {
  const startReview = useStartReview();
  const approve = useApprove();
  const reject = useReject();
  const bureau = useBureauCheck();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const busy = startReview.isPending || approve.isPending || reject.isPending;
  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= MIN_REJECTION_REASON_LENGTH;

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
            ? "Esta solicitud ya estaba aprobada: no se descontó el presupuesto nuevamente."
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
          setNotice("Solicitud rechazada.");
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
    <section className="card" aria-label="Acciones del analista">
      <h3>Revisión</h3>

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
        <p className="muted">
          Estado final: la solicitud no admite más transiciones ni reversiones.
        </p>
      )}

      {request.status === "CREADA" && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={handleStartReview}
        >
          {startReview.isPending ? "Procesando…" : "Tomar para revisión"}
        </button>
      )}

      {request.status === "EN_REVISION" && !rejecting && (
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={handleApprove}
          >
            {approve.isPending
              ? "Aprobando…"
              : `Aprobar (${formatMoney(request.amount)})`}
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
      )}

      {request.status === "EN_REVISION" && rejecting && (
        <div className="field">
          <label htmlFor="rejectReason">
            Motivo del rechazo (mínimo {MIN_REJECTION_REASON_LENGTH} caracteres)
          </label>
          <textarea
            id="rejectReason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <small className={reasonValid ? "muted" : "field-error"}>
            {reasonLength}/{MIN_REJECTION_REASON_LENGTH} caracteres mínimos
          </small>
          <div className="actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || !reasonValid}
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
    </section>
  );
}

function RequestHistory({ requestId }: { requestId: number }) {
  const audit = useAudit({ requestId, limit: 50 }, { refetchInterval: 3000 });

  return (
    <section className="card" aria-label="Historial de la solicitud">
      <h3>Historial de auditoría</h3>
      {audit.isLoading && <p role="status">Cargando historial…</p>}
      {audit.isError && (
        <div className="alert alert-error" role="alert">
          {audit.error.message}
        </div>
      )}
      {audit.data && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha (ISO 8601)</th>
                <th>Usuario</th>
                <th>Transición</th>
                <th>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <time className="mono" dateTime={entry.occurredAt}>
                      {entry.occurredAt}
                    </time>
                  </td>
                  <td>
                    {entry.actorName}{" "}
                    <small className="muted">({entry.actorRole})</small>
                  </td>
                  <td>
                    {entry.fromStatus ?? "—"} → {entry.toStatus}
                  </td>
                  <td>{entry.comment ?? "—"}</td>
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
  // Refresca el detalle para reflejar decisiones tomadas por otro analista.
  const requestQuery = useRequest(id, validId, 5000);

  if (!validId) {
    return (
      <div className="alert alert-error">
        Identificador de solicitud inválido.
      </div>
    );
  }
  if (requestQuery.isLoading) {
    return <p role="status">Cargando solicitud…</p>;
  }
  if (requestQuery.isError) {
    return (
      <>
        <div className="alert alert-error" role="alert">
          {requestQuery.error.message}
        </div>
        <Link to="/">Volver</Link>
      </>
    );
  }

  const request = requestQuery.data;
  if (!request || !user) {
    return null;
  }

  const isAnalyst = user.role === "ANALISTA";

  return (
    <>
      <div className="page-header">
        <h2>
          Solicitud #{request.id} <StatusBadge status={request.status} />
        </h2>
        <Link to={isAnalyst ? "/analyst" : "/requests"}>
          ← Volver al listado
        </Link>
      </div>

      <section className="card" aria-label="Datos de la solicitud">
        <dl className="summary summary-wide">
          <Info label="Solicitante">{request.applicantName}</Info>
          <Info label="Documento">{request.documentId}</Info>
          <Info label="Ingreso mensual">
            {formatMoney(request.monthlyIncome)}
          </Info>
          <Info label="Monto solicitado">{formatMoney(request.amount)}</Info>
          <Info label="Plazo">{request.termMonths} meses</Info>
          <Info label="Creada">{formatDateTime(request.createdAt)}</Info>
          <Info label="Última actualización">
            {formatDateTime(request.updatedAt)}
          </Info>
          {request.rejectionReason && (
            <Info label="Motivo del rechazo">{request.rejectionReason}</Info>
          )}
        </dl>
      </section>

      <BureauPanel request={request} />

      {isAnalyst && <ReviewActions request={request} />}

      <AmortizationTable
        principal={request.amount}
        termMonths={request.termMonths}
      />

      {isAnalyst && <RequestHistory requestId={request.id} />}
    </>
  );
}
