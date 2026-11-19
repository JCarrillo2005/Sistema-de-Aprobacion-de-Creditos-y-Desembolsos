import { Router } from "express";
import { config } from "../../config";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function scoreFromDocument(documentId: string): number {
  let hash = 0;
  for (const char of documentId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return 300 + (hash % 551); // 300..850, determinístico por documento
}

export const bureauMockRouter = Router();

// Simula un servicio externo: latencia 2-4 s y ~30% de fallos 503.
bureauMockRouter.get("/bureau/:documentId", async (req, res) => {
  const { minDelayMs, maxDelayMs, failureRate } = config.bureau;
  const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
  await sleep(delay);

  if (Math.random() < failureRate) {
    res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Buró crediticio no disponible",
      },
    });
    return;
  }

  const documentId = String(req.params.documentId);
  const score = scoreFromDocument(documentId);
  const risk = score >= 700 ? "BAJO" : score >= 600 ? "MEDIO" : "ALTO";
  res.json({ documentId, score, risk });
});
