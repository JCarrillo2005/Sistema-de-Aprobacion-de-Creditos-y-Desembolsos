import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRequests } from "../api/hooks";
import type { CreditRequest } from "../api/types";
import { LifecycleStepper } from "../components/LifecycleStepper";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime, formatMoney, formatPercent, formatRelativeAge } from "../lib/format";
import { debtRatioPercent } from "../lib/rules";

type Filter = "ALL" | "CREADA" | "EN_REVISION" | "RESUELTAS";

interface FilterOption {
  key: Filter;
  label: string;
}

const FILTERS: readonly FilterOption[] = [
  { key: "ALL", label: "Todas" },
  { key: "CREADA", label: "Creadas" },
  { key: "EN_REVISION", label: "En revisión" },
  { key: "RESUELTAS", label: "Resueltas" },
];

function isResolved(item: CreditRequest): boolean {
  return item.status === "APROBADA" || item.status === "RECHAZADA";
}

function matches(item: CreditRequest, filter: Filter): boolean {
  if (filter === "ALL") {
    return true;
  }
  if (filter === "RESUELTAS") {
    return isResolved(item);
  }
  return item.status === filter;
}

export default function AnalystDashboardPage() {
  const requestsQuery = useRequests({ refetchInterval: 5000 });
  const [filter, setFilter] = useState<Filter>("ALL");
  const all = requestsQuery.data;

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      ALL: all?.length ?? 0,
      CREADA: 0,
      EN_REVISION: 0,
      RESUELTAS: 0,
    };
    for (const item of all ?? []) {
      if (item.status === "CREADA" || item.status === "EN_REVISION") {
        result[item.status] += 1;
      } else {
        result.RESUELTAS += 1;
      }
    }
    return result;
  }, [all]);

  const visible = useMemo(
    () => (all ?? []).filter((item) => matches(item, filter)),
    [all, filter],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">Analista · bandeja operativa</span>
          <h2>Bandeja de revisión</h2>
        </div>
        <span className="sync-tag mono">ACTUALIZACIÓN 5s</span>
      </div>

      <div className="filter-bar" role="group" aria-label="Filtros por estado">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={filter === option.key ? "filter-btn active" : "filter-btn"}
            aria-pressed={filter === option.key}
            onClick={() => setFilter(option.key)}
          >
            <span>{option.label}</span>
            <span className="filter-count mono">{counts[option.key]}</span>
          </button>
        ))}
      </div>

      <p className="page-note">
        Riesgo de Endeudamiento = monto solicitado ÷ ingreso mensual declarado.
        El límite normativo es 40 %.
      </p>

      {requestsQuery.isLoading && (
        <div className="page-state" role="status">
          <span className="spinner" aria-hidden="true" /> Cargando bandeja…
        </div>
      )}
      {requestsQuery.isError && (
        <div className="alert alert-error" role="alert">
          {requestsQuery.error.message}
        </div>
      )}

      <section className="panel" aria-label="Solicitudes">
        <div className="panel-head">
          <div>
            <span className="eyebrow">{visible.length} en vista</span>
            <h3>Solicitudes</h3>
          </div>
        </div>

        {all && visible.length === 0 && (
          <div className="empty-state empty-state--inline">
            <p className="muted">No hay solicitudes en este estado.</p>
          </div>
        )}

        {visible.length > 0 && (
          <div className="table-scroll">
            <table className="table table--dense">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Solicitante</th>
                  <th>Documento</th>
                  <th className="num">Monto</th>
                  <th className="num">% Deuda</th>
                  <th className="num">Plazo</th>
                  <th>Estado</th>
                  <th>Ciclo</th>
                  <th>Antigüedad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const ratio = debtRatioPercent(item.amount, item.monthlyIncome);
                  return (
                    <tr key={item.id}>
                      <td className="mono">#{item.id}</td>
                      <td>
                        <strong className="table-primary">{item.applicantName}</strong>
                        <span className="table-sub mono">
                          ingreso {formatMoney(item.monthlyIncome)}
                        </span>
                      </td>
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
                          {formatRelativeAge(item.createdAt)}
                        </time>
                        <span className="table-sub mono">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </td>
                      <td>
                        <Link className="table-link" to={`/requests/${item.id}`}>
                          Revisar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
