import { MONTHLY_INTEREST_RATE } from "./rules";

export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface AmortizationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  schedule: AmortizationRow[];
}

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function buildAmortization(
  principal: number,
  termMonths: number,
  monthlyRate: number = MONTHLY_INTEREST_RATE,
): AmortizationResult {
  const monthlyPayment = round2(
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths)),
  );

  let balance = round2(principal);
  const schedule: AmortizationRow[] = [];

  for (let month = 1; month <= termMonths; month++) {
    const interest = round2(balance * monthlyRate);
    const isLast = month === termMonths;
    const principalPart = isLast ? balance : round2(monthlyPayment - interest);
    const payment = isLast ? round2(principalPart + interest) : monthlyPayment;
    balance = round2(balance - principalPart);
    schedule.push({
      month,
      payment,
      interest,
      principal: principalPart,
      balance,
    });
  }

  const totalPayment = round2(
    schedule.reduce((acc, row) => acc + row.payment, 0),
  );
  const totalInterest = round2(
    schedule.reduce((acc, row) => acc + row.interest, 0),
  );

  return { monthlyPayment, totalInterest, totalPayment, schedule };
}
