import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../http/asyncHandler";
import {
  authenticate,
  requireRole,
} from "../../http/auth.middleware";
import { parseWith } from "../../http/validate";
import { listAudit } from "./audit.service";

const querySchema = z.object({
  requestId: z.coerce.number().int().positive().optional(),
  afterId: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const auditRouter = Router();

auditRouter.get(
  "/",
  authenticate,
  requireRole("ANALISTA"),
  asyncHandler(async (req, res) => {
    const filters = parseWith(querySchema, req.query);
    res.json({ entries: await listAudit(filters) });
  }),
);
