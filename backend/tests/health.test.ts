import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";

afterAll(async () => {
  await pool.end();
});

describe("GET /health", () => {
  it("responde 200 sin requerir la base de datos", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok" });
    expect(typeof response.body.timestamp).toBe("string");
  });
});

describe("rutas desconocidas", () => {
  it("devuelve el formato de error uniforme", async () => {
    const response = await request(createApp()).get("/api/no-existe");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
