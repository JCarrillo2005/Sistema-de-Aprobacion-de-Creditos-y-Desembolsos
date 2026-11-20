import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { migrate } from "../src/db/migrate";
import { pool } from "../src/db/pool";

const app = createApp();

const validPayload = {
  applicantName: "Juan Pérez",
  documentId: "DOC-1001",
  monthlyIncome: 2000,
  amount: 800,
  termMonths: 12,
};

async function login(userId: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ userId });
  return res.body.token as string;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createRequestAs(
  token: string,
  overrides: Record<string, unknown> = {},
) {
  return request(app)
    .post("/api/requests")
    .set(bearer(token))
    .send({ ...validPayload, ...overrides });
}

async function moveToReview(analystToken: string, id: number) {
  await request(app)
    .post(`/api/requests/${id}/start-review`)
    .set(bearer(analystToken))
    .send({})
    .expect(200);
}

beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  await pool.query(
    "TRUNCATE audit_log, credit_requests RESTART IDENTITY CASCADE",
  );
  await pool.query("UPDATE budget SET available = 50000 WHERE id = 1");
});

afterAll(async () => {
  await pool.end();
});

describe("validación y restricciones de creación", () => {
  it("el backend rechaza montos superiores al 40% del ingreso", async () => {
    const solicitante = await login("sol-1");
    const res = await createRequestAs(solicitante, { amount: 900 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rechaza montos con más de dos decimales", async () => {
    const solicitante = await login("sol-1");
    const res = await createRequestAs(solicitante, {
      amount: 9.99999999999999,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("2 decimales");
  });

  it("responde 400 (no 500) cuando el 40% tiene fracciones de centavo", async () => {
    const solicitante = await login("sol-1");
    const res = await createRequestAs(solicitante, {
      monthlyIncome: 999.99,
      amount: 400,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("bloquea una nueva solicitud si hay una PENDIENTE reciente del mismo documento", async () => {
    const solicitante = await login("sol-1");
    const first = await createRequestAs(solicitante);
    expect(first.status).toBe(201);

    const second = await createRequestAs(solicitante, {
      documentId: "doc-1001",
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("RECENT_HISTORY_BLOCK");
    expect(second.body.error.message).toContain("#1");
    expect(second.body.error.message).toContain("PENDIENTE");
  });

  it("permite crear otra solicitud cuando la RECHAZADA tiene más de 30 días", async () => {
    const solicitante = await login("sol-1");
    const analista = await login("ana-1");

    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;
    await moveToReview(analista, id);
    await request(app)
      .post(`/api/requests/${id}/reject`)
      .set(bearer(analista))
      .send({ comment: "Ingresos no verificables en el buró" })
      .expect(200);

    const blocked = await createRequestAs(solicitante);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain("RECHAZADA");

    await pool.query(
      `UPDATE credit_requests SET created_at = now() - interval '31 days'`,
    );
    const allowed = await createRequestAs(solicitante);
    expect(allowed.status).toBe(201);
  });
});

describe("consulta previa por documento", () => {
  it("detecta una solicitud pendiente del mismo documento", async () => {
    const solicitante = await login("sol-1");
    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;

    const status = await request(app)
      .get("/api/requests/document-status")
      .query({ documentId: "doc-1001" })
      .set(bearer(solicitante));

    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      blocked: true,
      blockingRequestId: id,
      blockingStatus: "CREADA",
    });
    expect(status.body.blockingCreatedAt).toBeTruthy();
    expect(status.body.message).toContain("PENDIENTE");
  });

  it("marca el documento disponible cuando el rechazo supera los 30 días", async () => {
    const solicitante = await login("sol-1");
    const analista = await login("ana-1");
    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;
    await moveToReview(analista, id);
    await request(app)
      .post(`/api/requests/${id}/reject`)
      .set(bearer(analista))
      .send({ comment: "Historial crediticio insuficiente" })
      .expect(200);

    const blocked = await request(app)
      .get("/api/requests/document-status")
      .query({ documentId: "DOC-1001" })
      .set(bearer(solicitante));
    expect(blocked.body.blocked).toBe(true);
    expect(blocked.body.blockingStatus).toBe("RECHAZADA");
    expect(blocked.body.blockingCreatedAt).toBeTruthy();
    expect(blocked.body.blockedUntil).toBeTruthy();

    await pool.query(
      `UPDATE credit_requests SET created_at = now() - interval '31 days'`,
    );
    const free = await request(app)
      .get("/api/requests/document-status")
      .query({ documentId: "DOC-1001" })
      .set(bearer(solicitante));
    expect(free.body.blocked).toBe(false);
  });

  it("exige autenticación", async () => {
    const res = await request(app)
      .get("/api/requests/document-status")
      .query({ documentId: "DOC-1001" });
    expect(res.status).toBe(401);
  });
});

describe("transiciones de estado", () => {
  it("no permite saltos ni reversiones y exige motivo de rechazo de 15+ caracteres", async () => {
    const solicitante = await login("sol-1");
    const analista = await login("ana-1");

    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;

    // CREADA -> APROBADA (salto)
    const jump = await request(app)
      .post(`/api/requests/${id}/approve`)
      .set(bearer(analista))
      .send({});
    expect(jump.status).toBe(409);
    expect(jump.body.error.code).toBe("INVALID_TRANSITION");

    await moveToReview(analista, id);

    const shortReason = await request(app)
      .post(`/api/requests/${id}/reject`)
      .set(bearer(analista))
      .send({ comment: "muy corto" });
    expect(shortReason.status).toBe(400);

    await request(app)
      .post(`/api/requests/${id}/reject`)
      .set(bearer(analista))
      .send({ comment: "Historial crediticio insuficiente" })
      .expect(200);

    // RECHAZADA -> APROBADA (reversión)
    const reversal = await request(app)
      .post(`/api/requests/${id}/approve`)
      .set(bearer(analista))
      .send({});
    expect(reversal.status).toBe(409);

    const budget = await request(app)
      .get("/api/budget")
      .set(bearer(analista));
    expect(budget.body.available).toBe(50000);
  });

  it("falla con 422 y no cambia el estado si el presupuesto no alcanza", async () => {
    const solicitante = await login("sol-1");
    const analista = await login("ana-1");
    await pool.query("UPDATE budget SET available = 100 WHERE id = 1");

    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;
    await moveToReview(analista, id);

    const res = await request(app)
      .post(`/api/requests/${id}/approve`)
      .set(bearer(analista))
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INSUFFICIENT_BUDGET");

    const check = await pool.query(
      "SELECT status FROM credit_requests WHERE id = $1",
      [id],
    );
    expect(check.rows[0]?.status).toBe("EN_REVISION");
  });
});

describe("concurrencia e idempotencia", () => {
  it("descuenta el presupuesto una sola vez ante 8 aprobaciones simultáneas", async () => {
    const solicitante = await login("sol-1");
    const analista = await login("ana-1");

    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;
    await moveToReview(analista, id);

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app)
          .post(`/api/requests/${id}/approve`)
          .set(bearer(analista))
          .send({}),
      ),
    );

    expect(responses.every((res) => res.status === 200)).toBe(true);
    expect(
      responses.filter((res) => res.body.idempotent === false),
    ).toHaveLength(1);
    expect(
      responses.filter((res) => res.body.idempotent === true),
    ).toHaveLength(7);

    const budget = await request(app)
      .get("/api/budget")
      .set(bearer(analista));
    expect(budget.body.available).toBe(49200);

    const audit = await pool.query(
      `SELECT count(*)::int AS total FROM audit_log WHERE request_id = $1 AND to_status = 'APROBADA'`,
      [id],
    );
    expect(audit.rows[0]?.total).toBe(1);
  });
});

describe("roles y auditoría", () => {
  it("aplica permisos en el servidor", async () => {
    const solicitante = await login("sol-1");
    const otroSolicitante = await login("sol-2");
    const analista = await login("ana-1");

    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;
    await moveToReview(analista, id);

    const approveAsApplicant = await request(app)
      .post(`/api/requests/${id}/approve`)
      .set(bearer(solicitante))
      .send({});
    expect(approveAsApplicant.status).toBe(403);

    expect(
      (await request(app).get("/api/budget").set(bearer(solicitante))).status,
    ).toBe(403);
    expect(
      (await request(app).get("/api/audit").set(bearer(solicitante))).status,
    ).toBe(403);
    expect((await request(app).get("/api/requests")).status).toBe(401);

    const foreign = await request(app)
      .get(`/api/requests/${id}`)
      .set(bearer(otroSolicitante));
    expect(foreign.status).toBe(404);

    const analystCreates = await createRequestAs(analista, {
      documentId: "DOC-2002",
    });
    expect(analystCreates.status).toBe(403);
  });

  it("registra cada transición en el audit log y es inmutable", async () => {
    const solicitante = await login("sol-1");
    const analista = await login("ana-1");

    const created = await createRequestAs(solicitante);
    const id = created.body.request.id as number;
    await moveToReview(analista, id);
    await request(app)
      .post(`/api/requests/${id}/approve`)
      .set(bearer(analista))
      .send({})
      .expect(200);

    const audit = await request(app)
      .get(`/api/audit?requestId=${id}`)
      .set(bearer(analista));
    const transitions = (
      audit.body.entries as Array<{
        fromStatus: string | null;
        toStatus: string;
        occurredAt: string;
      }>
    )
      .map((entry) => `${entry.fromStatus ?? "null"}->${entry.toStatus}`)
      .reverse();
    expect(transitions).toEqual([
      "null->CREADA",
      "CREADA->EN_REVISION",
      "EN_REVISION->APROBADA",
    ]);
    expect(new Date(audit.body.entries[0].occurredAt).toISOString()).toBe(
      audit.body.entries[0].occurredAt,
    );

    await expect(
      pool.query(`UPDATE audit_log SET comment = 'manipulado'`),
    ).rejects.toThrow(/de solo inserción/);
    await expect(pool.query("DELETE FROM audit_log")).rejects.toThrow(
      /de solo inserción/,
    );
  });
});
