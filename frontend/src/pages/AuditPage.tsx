import { useState } from "react";
import { Link } from "react-router-dom";
import { useAudit } from "../api/hooks";

export default function AuditPage() {
  const [requestIdInput, setRequestIdInput] = useState("");

  const parsed = Number(requestIdInput);
  const requestId = Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;

  const audit = useAudit({ requestId, limit: 200 }, { refetchInterval: 3000 });

  return (
    <>
      <div className="page-header">
        <h2>Auditoría</h2>
        <span className="live" role="status">
          <span className="live-dot" aria-hidden="true" />
          En vivo
          {audit.dataUpdatedAt > 0 && (
            <small className="muted">
              {" "}
              · actualizado{" "}
              {new Date(audit.dataUpdatedAt).toLocaleTimeString("es-GT")}
            </small>
          )}
        </span>
      </div>

      <section className="card">
        <div className="card-header">
          <p className="muted">
            Registro inmutable de transiciones (solo inserción). Se actualiza
            automáticamente cada pocos segundos.
          </p>
          <label className="inline-field">
            Solicitud #
            <input
              type="number"
              min={1}
              placeholder="Todas"
              value={requestIdInput}
              onChange={(event) => setRequestIdInput(event.target.value)}
            />
          </label>
        </div>

        {audit.isLoading && <p role="status">Cargando auditoría…</p>}
        {audit.isError && (
          <div className="alert alert-error" role="alert">
            {audit.error.message}
          </div>
        )}
        {audit.data && audit.data.length === 0 && (
          <p className="muted">Sin registros todavía.</p>
        )}

        {audit.data && audit.data.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha (ISO 8601)</th>
                  <th>Solicitud</th>
                  <th>Usuario / rol</th>
                  <th>Estado anterior</th>
                  <th>Estado nuevo</th>
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
                      <Link to={`/requests/${entry.requestId}`}>
                        #{entry.requestId}
                      </Link>
                    </td>
                    <td>
                      {entry.actorName}{" "}
                      <span
                        className={`role-badge role-${entry.actorRole.toLowerCase()}`}
                      >
                        {entry.actorRole}
                      </span>
                    </td>
                    <td>{entry.fromStatus ?? "—"}</td>
                    <td>{entry.toStatus}</td>
                    <td>{entry.comment ?? "—"}</td>
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
