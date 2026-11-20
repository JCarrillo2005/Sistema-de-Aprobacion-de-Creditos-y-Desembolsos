import { config } from "../../config";
import { AppError } from "../../domain/errors";

export interface BureauResult {
  documentId: string;
  score: number;
  risk: "BAJO" | "MEDIO" | "ALTO";
  attempts: number;
}

export interface BureauOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  baseUrl?: string;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function queryBureau(
  documentId: string,
  options: BureauOptions = {},
): Promise<BureauResult> {
  const {
    maxAttempts = config.bureau.maxAttempts,
    baseDelayMs = config.bureau.backoffBaseMs,
    timeoutMs = config.bureau.timeoutMs,
    baseUrl = config.bureauBaseUrl,
  } = options;

  let lastReason = "desconocido";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `${baseUrl}/internal/bureau/${encodeURIComponent(documentId)}`,
        { signal: AbortSignal.timeout(timeoutMs) },
      );

      if (response.ok) {
        const body = (await response.json()) as Omit<BureauResult, "attempts">;
        return { ...body, attempts: attempt };
      }

      // Errores 4xx no son transitorios: no tiene sentido reintentar.
      if (response.status < 500) {
        throw new AppError(
          502,
          "BUREAU_BAD_RESPONSE",
          "El buró de crédito devolvió una respuesta no válida.",
        );
      }
      lastReason = `HTTP ${response.status}`;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      lastReason = error instanceof Error ? error.message : "error de red";
    }

    if (attempt < maxAttempts) {
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * baseDelayMs * 0.2;
      await sleep(backoff + jitter);
    }
  }

  console.warn(
    `[bureau] consulta agotada tras ${maxAttempts} intentos (${lastReason})`,
  );
  throw new AppError(
    503,
    "BUREAU_UNAVAILABLE",
    "El buró de crédito no está disponible en este momento. Intenta nuevamente en unos minutos.",
  );
}
