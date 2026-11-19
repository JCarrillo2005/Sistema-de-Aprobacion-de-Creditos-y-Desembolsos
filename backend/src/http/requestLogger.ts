import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logSink, type LogSink } from "./logger";

/** Devuelve el identificador de correlación o "-" si aún no se ha asignado. */
export function requestIdOf(res: Response): string {
  const value: unknown = res.locals.requestId;
  return typeof value === "string" ? value : "-";
}

/**
 * Registra una línea por petición terminada con método, ruta, estado y duración.
 * Nunca escribe cuerpos, tokens ni identificadores de documento.
 */
export function requestLogger(sink: LogSink = logSink) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    // El healthcheck es ruido; /internal/* además puede contener el documento en la URL.
    if (req.path === "/health" || req.path.startsWith("/internal/")) {
      next();
      return;
    }

    const startedAt = process.hrtime.bigint();
    res.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const [pathname] = req.originalUrl.split("?");
      const route = pathname ?? req.originalUrl;
      sink(
        `[http] ${res.statusCode} ${req.method} ${route} ${durationMs.toFixed(1)}ms id=${requestId}`,
      );
    });

    next();
  };
}
