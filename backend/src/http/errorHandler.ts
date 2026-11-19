import { ErrorRequestHandler, RequestHandler } from "express";
import { config } from "../config";
import { AppError } from "../domain/errors";
import { errorSink } from "./logger";
import { requestIdOf } from "./requestLogger";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    (error as { type?: string }).type === "entity.parse.failed"
  ) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "El cuerpo de la petición no es JSON válido",
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  errorSink(`[error] id=${requestIdOf(res)} code=INTERNAL_ERROR ${message}`);
  if (config.env === "development" && error instanceof Error && error.stack) {
    errorSink(error.stack);
  }
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
  });
};
