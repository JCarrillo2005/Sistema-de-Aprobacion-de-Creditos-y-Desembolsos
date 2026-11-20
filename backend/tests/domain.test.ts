import { describe, expect, it } from "vitest";
import { buildAmortization } from "../src/domain/amortization";
import { createRequestSchema, maxAllowedAmount } from "../src/domain/rules";

const base = {
  applicantName: "Juan Pérez",
  documentId: "doc-1001",
  monthlyIncome: 2000,
  amount: 800,
  termMonths: 12,
};

describe("reglas de negocio (dominio)", () => {
  it("acepta un monto igual al 40% del ingreso y normaliza el documento", () => {
    const parsed = createRequestSchema.parse(base);
    expect(parsed.documentId).toBe("DOC-1001");
    expect(maxAllowedAmount(2000)).toBe(800);
  });

  it("rechaza un monto superior al 40% del ingreso mensual", () => {
    const result = createRequestSchema.safeParse({ ...base, amount: 800.01 });
    expect(result.success).toBe(false);
  });

  it("rechaza plazos fuera de 6, 12, 24 o 36 meses", () => {
    expect(createRequestSchema.safeParse({ ...base, termMonths: 18 }).success).toBe(
      false,
    );
  });

  it("trunca el máximo permitido a centavos para no superar el CHECK de PostgreSQL", () => {
    expect(maxAllowedAmount(999.99)).toBe(399.99);
    expect(maxAllowedAmount(1000)).toBe(400);
    expect(maxAllowedAmount(2000)).toBe(800);
  });

  it("rechaza montos con más de dos decimales", () => {
    const result = createRequestSchema.safeParse({
      ...base,
      amount: 9.99999999999999,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "El monto admite como máximo 2 decimales",
      );
    }
  });

  it("rechaza ingresos con más de dos decimales", () => {
    expect(
      createRequestSchema.safeParse({ ...base, monthlyIncome: 2000.001 }).success,
    ).toBe(false);
  });

  it("calcula una amortización que cierra en saldo cero", () => {
    const result = buildAmortization(1000, 12);
    expect(result.monthlyPayment).toBeCloseTo(91.68, 2);
    expect(result.schedule).toHaveLength(12);
    expect(result.schedule[11]?.balance).toBe(0);
    expect(result.schedule[0]?.interest).toBe(15);
  });
});
