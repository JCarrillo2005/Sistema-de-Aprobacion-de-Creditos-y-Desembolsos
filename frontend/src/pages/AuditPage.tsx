import { useState } from "react";
import { Link } from "react-router-dom";
import { useAudit } from "../api/hooks";
import { TransitionBadge } from "../components/TransitionBadge";
import { formatClockTime, formatDateTime } from "../lib/format";
import { roleLabel } from "../lib/labels";

export default function AuditPage() {
  const [requestIdInput, setRequestIdInput] = useState("");

  const parsed = Number(requestIdInput);
  const requestId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  const audit = useAudit(
    { requestId, limit: 200 },
    { refetchInterval: 3000 },
  );

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Auditoría · registro inmutable</span>
          <h2>Registro de decisiones</h2>
        </div>
        <div className="ledger-status" role="status">
          <span className={audit.isError ? "live-dot live-dot--error" : "live-dot"} aria-hidden="true" />
          <span>{audit.isError ? "No disponible" : "Actualizado"}</span>
          {audit.dataUpdatedAt > 0 && (
            <span className="mono">
              {formatClockTime(audit.dataUpdatedAt)}
            </span>
          )}
        </div>
      </div>

      <p className="page-note">
        Cada transición queda grabada con usuario, rol, comentario y fecha. El
        registro es de solo inserción: no admite ediciones ni borrados.
      </p>

      <section className="panel ledger" aria-label="Registro de auditoría">
        <div className="panel-head">
          <div>
            <span className="eyebrow">{audit.data?.length ?? 0} eventos</span>
            <h3>Historial de transiciones</h3>
          </div>
          <label className="inline-field">
            <span className="eyebrow">Filtrar solicitud</span>
            <input
              type="number"
              min={1}
              className="mono filter-input"
              placeholder="Todas"
              aria-label="Filtrar por número de solicitud"
              value={requestIdInput}
              onChange={(event) => setRequestIdInput(event.target.value)}
            />
          </label>
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
        {audit.data && audit.data.length === 0 && (
          <div className="empty-state empty-state--inline">
            <p className="muted">Sin eventos para el filtro seleccionado.</p>
          </div>
        )}

        {audit.data && audit.data.length > 0 && (
          <div className="table-scroll">
            <table className="table table--dense ledger-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha y hora</th>
                  <th>Transición</th>
                  <th>Usuario · rol</th>
                  <th>Comentario</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">
                      <Link className="table-link" to={`/requests/${entry.requestId}`}>
                        #{entry.requestId}
                      </Link>
                      <span className="table-sub mono">Evento {entry.id}</span>
                    </td>
                    <td>
                      <time dateTime={entry.occurredAt} title={entry.occurredAt}>
                        {formatDateTime(entry.occurredAt)}
                      </time>
                      <span className="table-sub mono">{entry.occurredAt}</span>
                    </td>
                    <td>
                      <TransitionBadge
                        fromStatus={entry.fromStatus}
                        toStatus={entry.toStatus}
                      />
                    </td>
                    <td>
                      <span className="table-primary">{entry.actorName}</span>
                      <span className="table-sub mono">{entry.actorEmail ?? "—"}</span>
                      <span className={`role-badge role-${entry.actorRole.toLowerCase()}`}>
                        {roleLabel(entry.actorRole)}
                      </span>
                    </td>
                    <td className="comment-cell" title={entry.comment ?? ""}>
                      {entry.comment ?? "—"}
                    </td>
                    <td>
                      <span className="immutable-badge mono">Inmutable</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
