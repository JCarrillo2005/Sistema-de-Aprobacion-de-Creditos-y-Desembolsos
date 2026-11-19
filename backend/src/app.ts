import cors from "cors";
import express from "express";
import { config } from "./config";
import { errorHandler, notFoundHandler } from "./http/errorHandler";
import { auditRouter } from "./modules/audit/audit.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { budgetRouter } from "./modules/budget/budget.routes";
import { bureauMockRouter } from "./modules/bureau/bureau.mock.routes";
import { requestsRouter } from "./modules/requests/requests.routes";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Servicio externo simulado (no expuesto por el proxy del frontend).
  app.use("/internal", bureauMockRouter);

  app.use("/api/auth", authRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/budget", budgetRouter);
  app.use("/api/audit", auditRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
