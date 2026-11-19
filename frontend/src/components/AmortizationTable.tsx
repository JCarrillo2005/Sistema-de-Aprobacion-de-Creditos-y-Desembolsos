import { useMemo } from "react";
import { buildAmortization } from "../lib/amortization";
import { formatMoney } from "../lib/format";
import { MONTHLY_INTEREST_RATE } from "../lib/rules";

interface Props {
  principal: number;
  termMonths: number;
}

export function AmortizationTable({ principal, termMonths }: Props) {
  const result = useMemo(
    () => buildAmortization(principal, termMonths),
    [principal, termMonths],
  );

  return (
    <section className="panel simulator" aria-label="Simulación financiera">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Sistema francés · cuota fija</span>
          <h3>Simulación financiera</h3>
        </div>
        <span className="rate-chip mono">
          {(MONTHLY_INTEREST_RATE * 100).toFixed(1)} % / MES
        </span>
      </div>

      <div className="sim-hero">
        <span className="eyebrow">Cuota mensual estimada</span>
        <p className="sim-hero-value mono">{formatMoney(result.monthlyPayment)}</p>
        <span className="sim-hero-meta mono">
          {result.schedule.length} cuotas · tasa fija sobre saldo
        </span>
      </div>

      <dl className="metric-grid">
        <div>
          <dt>Capital solicitado</dt>
          <dd className="mono">{formatMoney(principal)}</dd>
        </div>
        <div>
          <dt>Total de intereses</dt>
          <dd className="mono">{formatMoney(result.totalInterest)}</dd>
        </div>
        <div>
          <dt>Monto total a pagar</dt>
          <dd className="mono">{formatMoney(result.totalPayment)}</dd>
        </div>
      </dl>

      <details className="schedule">
        <summary>
          <span>Desglose mes a mes</span>
          <span className="mono">{result.schedule.length} filas</span>
        </summary>
        <div className="table-scroll table-scroll--schedule">
          <table className="table table--dense">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="num">Cuota</th>
                <th className="num">Capital</th>
                <th className="num">Interés</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((row) => (
                <tr key={row.month}>
                  <td className="mono">{String(row.month).padStart(2, "0")}</td>
                  <td className="num mono">{formatMoney(row.payment)}</td>
                  <td className="num mono">{formatMoney(row.principal)}</td>
                  <td className="num mono">{formatMoney(row.interest)}</td>
                  <td className="num mono">{formatMoney(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="fineprint mono">Estimación · tasa y sistema del servidor.</p>
    </section>
  );
}
