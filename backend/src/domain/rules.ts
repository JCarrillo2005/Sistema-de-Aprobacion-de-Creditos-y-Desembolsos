import { z } from "zod";

export const ALLOWED_TERMS = [6, 12, 24, 36] as const;
export const MAX_DEBT_RATIO = 0.4;
export const MONTHLY_INTEREST_RATE = 0.015;
export const HISTORY_WINDOW_DAYS = 30;
export const MIN_REJECTION_REASON_LENGTH = 15;

export function maxAllowedAmount(monthlyIncome: number): number {
  return Math.round(monthlyIncome * MAX_DEBT_RATIO * 100) / 100;
}

export const createRequestSchema = z
  .object({
    applicantName: z
      .string()
      .trim()
      .min(3, "El nombre debe tener al menos 3 caracteres")
      .max(120, "El nombre es demasiado largo"),
    documentId: z
      .string()
      .trim()
      .min(5, "El documento debe tener al menos 5 caracteres")
      .max(20, "El documento no puede superar 20 caracteres")
      .regex(
        /^[A-Za-z0-9-]+$/,
        "El documento solo admite letras, números y guiones",
      )
      .transform((value) => value.toUpperCase()),
    monthlyIncome: z
      .number({ invalid_type_error: "El ingreso mensual debe ser un número" })
      .positive("El ingreso mensual debe ser mayor a 0")
      .max(10_000_000, "Ingreso mensual fuera de rango"),
    amount: z
      .number({ invalid_type_error: "El monto debe ser un número" })
      .positive("El monto debe ser mayor a 0")
      .max(10_000_000, "Monto fuera de rango"),
    termMonths: z
      .number({ invalid_type_error: "El plazo debe ser un número" })
      .int()
      .refine((value) => (ALLOWED_TERMS as readonly number[]).includes(value), {
        message: "El plazo debe ser 6, 12, 24 o 36 meses",
      }),
  })
  .superRefine((value, ctx) => {
    const max = maxAllowedAmount(value.monthlyIncome);
    if (value.amount > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: `El monto solicitado no puede superar el 40% del ingreso mensual declarado (máximo permitido: ${max.toFixed(2)})`,
      });
    }
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const rejectSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(
      MIN_REJECTION_REASON_LENGTH,
      `El motivo de rechazo debe tener al menos ${MIN_REJECTION_REASON_LENGTH} caracteres`,
    )
    .max(500, "El motivo de rechazo no puede superar 500 caracteres"),
});

export const optionalCommentSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

export const idSchema = z.coerce
  .number({ invalid_type_error: "Identificador inválido" })
  .int()
  .positive("Identificador inválido");
