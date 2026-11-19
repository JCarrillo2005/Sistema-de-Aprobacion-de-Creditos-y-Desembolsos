import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBudget, useRequests } from "../api/hooks";
import { REQUEST_STATUSES, type RequestStatus } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatMoney } from "../lib/format";

type Filter = RequestStatus | "ALL";

export default function AnalystDashboardPage() {
  const budgetQuery = useBudget(5000);
  const requestsQuery = useRequests({ refetchInterval: 5000 });
  const [filter, setFilter] = useState<Filter>("ALL");

  const all = requestsQuery.data;

  const counts = useMemo(() => {
    const base: Record<RequestStatus, number> = {
      CREADA: 0,
      EN_REVISION: 0,
      APROBADA: 0,
      RECHAZADA: 0,
    };
    for (const item of all ?? []) {
      base[item.status] += 1;
    }
    return base;
  }, [all]);

  const visible = useMemo(
    () =>
      (all ?? []).filter((item) => filter === "ALL" || item.status === filter),
    [all, filter],
  );

  const budget = budgetQuery.data;
  const used = budget ? budget.initial - budget.available : 0;
  const usedPercent =
    budget && budget.initial > 0 ? (used / budget.initial) * 100 : 0;

  return (
    <>
      <div className="page-header">
        <h2>Panel de analista</h2>
      </div>

      <section className="card" aria-label="Presupuesto global">
        <h3>Presupuesto global disponible</h3>
        {budgetQuery.isLoading && <p role="status">Cargando presupuesto…</p>}
        {budgetQuery.isError && (
          <div className="alert alert-error" role="alert">
            {budgetQuery.error.message}
          </div>
        )}
        {budget && (
          <>
            <p className="budget-amount">{formatMoney(budget.available)}</p>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPercent)}
              aria-label="Presupuesto utilizado"
            >
              <div
                className="progress-bar"
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <p className="muted">
              Comprometido {formatMoney(used)} de {formatMoney(budget.initial)}{" "}
              ({usedPercent.toFixed(1)} %)
            </p>
          </>
        )}
      </section>

      <section className="stats" aria-label="Resumen por estado">
        {REQUEST_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={filter === status ? "stat stat-active" : "stat"}
            onClick={() =>
              setFilter((current) => (current === status ? "ALL" : status))
            }
          >
            <StatusBadge status={status} />
            <strong>{counts[status]}</strong>
          </button>
        ))}
      </section>

      <section className="card" aria-label="Solicitudes">
        <div className="card-header">
          <h3>Solicitudes</h3>
          <label className="inline-field">
            Estado
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="ALL">Todos</option>
              {REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {requestsQuery.isLoading && <p role="status">Cargando solicitudes…</p>}
        {requestsQuery.isError && (
          <div className="alert alert-error" role="alert">
            {requestsQuery.error.message}
          </div>
        )}
        {all && visible.length === 0 && (
          <p className="muted">No hay solicitudes para mostrar.</p>
        )}

        {visible.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Solicitante</th>
                  <th>Documento</th>
                  <th className="num">Monto</th>
                  <th className="num">Plazo</th>
                  <th>Estado</th>
                  <th>Creada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.applicantName}</td>
                    <td>{item.documentId}</td>
                    <td className="num">{formatMoney(item.amount)}</td>
                    <td className="num">{item.termMonths} m</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>
                      <Link to={`/requests/${item.id}`}>Revisar</Link>
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
