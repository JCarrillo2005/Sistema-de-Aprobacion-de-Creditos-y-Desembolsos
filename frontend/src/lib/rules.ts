import type { CreateRequestPayload } from "../api/types";

// Estas reglas replican las del backend (backend/src/domain/rules.ts) para dar
// retroalimentación inmediata. El backend sigue siendo la fuente de verdad.
export const ALLOWED_TERMS = [6, 12, 24, 36] as const;
export const MAX_DEBT_RATIO = 0.4;
export const MONTHLY_INTEREST_RATE = 0.015;
export const MIN_REJECTION_REASON_LENGTH = 15;

export interface RequestFormValues {
  applicantName: string;
  documentId: string;
  monthlyIncome: string;
  amount: string;
  termMonths: string;
}

export type RequestFormField = keyof RequestFormValues;
export type RequestFormErrors = Partial<Record<RequestFormField, string>>;
export type ValidRequest = CreateRequestPayload;

export function maxAllowedAmount(monthlyIncome: number): number {
  return Math.round(monthlyIncome * MAX_DEBT_RATIO * 100) / 100;
}

export function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function validateRequestForm(values: RequestFormValues): {
  errors: RequestFormErrors;
  valid: ValidRequest | null;
} {
  const errors: RequestFormErrors = {};

  const applicantName = values.applicantName.trim();
  if (applicantName.length < 3) {
    errors.applicantName = "El nombre debe tener al menos 3 caracteres";
  } else if (applicantName.length > 120) {
    errors.applicantName = "El nombre es demasiado largo";
  }

  const documentId = values.documentId.trim();
  if (documentId.length < 5) {
    errors.documentId = "El documento debe tener al menos 5 caracteres";
  } else if (documentId.length > 20) {
    errors.documentId = "El documento no puede superar 20 caracteres";
  } else if (!/^[A-Za-z0-9-]+$/.test(documentId)) {
    errors.documentId = "El documento solo admite letras, números y guiones";
  }

  const monthlyIncome = parseNumber(values.monthlyIncome);
  if (monthlyIncome === null) {
    errors.monthlyIncome = "Ingresa el ingreso mensual declarado";
  } else if (monthlyIncome <= 0) {
    errors.monthlyIncome = "El ingreso mensual debe ser mayor a 0";
  } else if (monthlyIncome > 10_000_000) {
    errors.monthlyIncome = "Ingreso mensual fuera de rango";
  }

  const amount = parseNumber(values.amount);
  if (amount === null) {
    errors.amount = "Ingresa el monto solicitado";
  } else if (amount <= 0) {
    errors.amount = "El monto debe ser mayor a 0";
  } else if (amount > 10_000_000) {
    errors.amount = "Monto fuera de rango";
  } else if (
    monthlyIncome !== null &&
    monthlyIncome > 0 &&
    !errors.monthlyIncome
  ) {
    const max = maxAllowedAmount(monthlyIncome);
    if (amount > max) {
      errors.amount = `El monto solicitado no puede superar el 40% del ingreso mensual declarado (máximo permitido: ${max.toFixed(2)})`;
    }
  }

  const termMonths = parseNumber(values.termMonths);
  if (
    termMonths === null ||
    !(ALLOWED_TERMS as readonly number[]).includes(termMonths)
  ) {
    errors.termMonths = "El plazo debe ser 6, 12, 24 o 36 meses";
  }

  if (
    Object.keys(errors).length > 0 ||
    monthlyIncome === null ||
    amount === null ||
    termMonths === null
  ) {
    return { errors, valid: null };
  }

  return {
    errors,
    valid: {
      applicantName,
      documentId: documentId.toUpperCase(),
      monthlyIncome,
      amount,
      termMonths,
    },
  };
}
