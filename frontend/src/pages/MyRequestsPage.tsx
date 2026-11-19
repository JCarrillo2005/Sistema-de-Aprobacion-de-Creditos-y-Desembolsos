import { Link } from "react-router-dom";
import { useRequests } from "../api/hooks";
import { LifecycleStepper } from "../components/LifecycleStepper";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatMoney, formatPercent, formatRelativeAge } from "../lib/format";
import { debtRatioPercent } from "../lib/rules";

export default function MyRequestsPage() {
  const { data, isLoading, isError, error } = useRequests({
    refetchInterval: 5000,
  });

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Solicitante · cartera propia</span>
          <h2>Mis solicitudes</h2>
        </div>
        <Link to="/requests/new" className="btn btn-primary">
          Nueva solicitud
        </Link>
      </div>

      <p className="page-note">
        Consulta el estado de cada operación. Los rechazos recientes bloquean
        nuevas solicitudes con el mismo documento durante 30 días.
      </p>

      {isLoading && (
        <div className="page-state" role="status">
          <span className="spinner" aria-hidden="true" /> Cargando solicitudes…
        </div>
      )}
      {isError && (
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
      )}

      {data && data.length === 0 && (
        <section className="panel empty-state">
          <h3>Sin solicitudes registradas</h3>
          <p className="muted">
            Completa el formulario para simular tu primer crédito y ver la
            proyección financiera antes de enviarlo.
          </p>
          <Link to="/requests/new" className="btn btn-secondary">
            Crear la primera solicitud
          </Link>
        </section>
      )}

      {data && data.length > 0 && (
        <section className="panel" aria-label="Listado de solicitudes">
          <div className="panel-head">
            <div>
              <span className="eyebrow">{data.length} registros</span>
              <h3>Historial de solicitudes</h3>
            </div>
            <span className="sync-tag mono">SYNC 5s</span>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Solicitud</th>
                  <th>Documento</th>
                  <th className="num">Monto</th>
                  <th className="num">Endeudamiento</th>
                  <th className="num">Plazo</th>
                  <th>Estado</th>
                  <th>Ciclo</th>
                  <th>Creada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((item) => {
                  const ratio = debtRatioPercent(item.amount, item.monthlyIncome);
                  return (
                    <tr key={item.id}>
                      <td className="mono">#{item.id}</td>
                      <td className="mono">{item.documentId}</td>
                      <td className="num mono">{formatMoney(item.amount)}</td>
                      <td className="num">
                        {ratio !== null && (
                          <span className={`ratio-cell mono${ratio > 36 ? " ratio-cell--warn" : ""}`}>
                            {formatPercent(ratio)}
                          </span>
                        )}
                      </td>
                      <td className="num mono">{item.termMonths} m</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <LifecycleStepper status={item.status} compact />
                      </td>
                      <td>
                        <time className="mono" dateTime={item.createdAt} title={item.createdAt}>
                          {formatDateTime(item.createdAt)}
                        </time>
                        <span className="table-sub mono">{formatRelativeAge(item.createdAt)}</span>
                      </td>
                      <td>
                        <Link className="table-link" to={`/requests/${item.id}`}>
                          Detalle →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
