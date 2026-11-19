import { useMemo } from "react";
import { buildAmortization } from "../lib/amortization";
import { formatMoney } from "../lib/format";

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
    <section className="card" aria-label="Simulación financiera">
      <h3>Simulación financiera</h3>
      <p className="muted">
        Interés fijo del 1.5 % mensual sobre saldo, cuota mensual constante. Es
        una estimación.
      </p>

      <dl className="summary">
        <div>
          <dt>Cuota mensual estimada</dt>
          <dd>{formatMoney(result.monthlyPayment)}</dd>
        </div>
        <div>
          <dt>Total de intereses</dt>
          <dd>{formatMoney(result.totalInterest)}</dd>
        </div>
        <div>
          <dt>Total a pagar</dt>
          <dd>{formatMoney(result.totalPayment)}</dd>
        </div>
      </dl>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Mes</th>
              <th className="num">Cuota</th>
              <th className="num">Capital</th>
              <th className="num">Interés (1.5 %)</th>
              <th className="num">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {result.schedule.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td className="num">{formatMoney(row.payment)}</td>
                <td className="num">{formatMoney(row.principal)}</td>
                <td className="num">{formatMoney(row.interest)}</td>
                <td className="num">{formatMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
