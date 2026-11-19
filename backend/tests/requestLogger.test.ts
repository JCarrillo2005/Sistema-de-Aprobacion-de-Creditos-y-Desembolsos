import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requestLogger } from "../src/http/requestLogger";

function buildApp(lines: string[]) {
  const app = express();
  app.use(requestLogger((line) => lines.push(line)));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/ejemplo", (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe("requestLogger", () => {
  it("registra la petición terminada y devuelve el id de correlación", async () => {
    const lines: string[] = [];
    const response = await request(buildApp(lines)).get("/api/ejemplo");

    expect(response.status).toBe(200);
    const header = response.get("X-Request-Id");
    expect(header).toBeDefined();
    expect(header ?? "").toMatch(/^[0-9a-f-]{36}$/);
    expect(lines).toHaveLength(1);
    expect(lines[0] ?? "").toMatch(
      /^\[http\] 200 GET \/api\/ejemplo \d+\.\d+ms id=[0-9a-f-]{36}$/,
    );
  });

  it("no registra health ni rutas internas", async () => {
    const lines: string[] = [];
    const app = buildApp(lines);
    app.get("/internal/bureau/DOC-1", (_req, res) => {
      res.json({ ok: true });
    });

    await request(app).get("/health");
    await request(app).get("/internal/bureau/DOC-1");

    expect(lines).toHaveLength(0);
  });
});
