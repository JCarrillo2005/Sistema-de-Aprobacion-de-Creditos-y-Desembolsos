import { useBudget } from "../api/hooks";
import { formatMoney, formatPercent } from "../lib/format";
import { UpdatedTag } from "./UpdatedTag";

interface Props {
  variant?: "sidebar" | "chip";
}

// El presupuesto se consulta con TanStack Query y se comparte con el dictamen:
// no se guarda una copia en estado local.
export function BudgetWidget({ variant = "sidebar" }: Props) {
  const budget = useBudget(5000);
  const data = budget.data;

  if (variant === "chip") {
    return (
      <div className="budget-chip" title="Presupuesto global disponible (actualización automática)">
        <span className="eyebrow">Disponible</span>
        <strong className="mono">
          {data ? formatMoney(data.available) : "—"}
        </strong>
        <span className="budget-chip-currency mono">USD</span>
      </div>
    );
  }

  const used = data ? data.initial - data.available : 0;
  const usedPercent =
    data && data.initial > 0 ? (used / data.initial) * 100 : 0;

  return (
    <section className="budget-widget" aria-label="Presupuesto global disponible">
      <div className="budget-widget-head">
        <span className="eyebrow">Presupuesto global</span>
        <UpdatedTag at={budget.dataUpdatedAt} />
      </div>
      {budget.isLoading && <p className="budget-widget-loading">Cargando…</p>}
      {budget.isError && (
        <p className="budget-widget-error" role="alert">
          {budget.error.message}
        </p>
      )}
      {data && (
        <>
          <p className="budget-widget-value mono">
            {formatMoney(data.available)}
            <span>USD</span>
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPercent)}
            aria-label="Presupuesto global consumido"
          >
            <div className="progress-bar" style={{ width: `${usedPercent}%` }} />
          </div>
          <div className="budget-widget-foot mono">
            <span>{formatMoney(used)} consumido</span>
            <span>{formatPercent(usedPercent)}</span>
          </div>
        </>
      )}
    </section>
  );
}
