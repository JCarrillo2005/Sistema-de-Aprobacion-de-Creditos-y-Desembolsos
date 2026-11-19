import { Router } from "express";
import { config } from "../../config";
import { pool } from "../../db/pool";
import { asyncHandler } from "../../http/asyncHandler";
import {
  authenticate,
  requireRole,
} from "../../http/auth.middleware";

export const budgetRouter = Router();

budgetRouter.get(
  "/",
  authenticate,
  requireRole("ANALISTA"),
  asyncHandler(async (_req, res) => {
    const result = await pool.query<{ available: string }>(
      "SELECT available FROM budget WHERE id = 1",
    );
    res.json({
      available: Number(result.rows[0]?.available ?? 0),
      initial: config.initialBudget,
    });
  }),
);
