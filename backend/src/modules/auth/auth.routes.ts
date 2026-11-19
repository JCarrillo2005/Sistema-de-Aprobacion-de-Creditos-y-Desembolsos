import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../domain/errors";
import { asyncHandler } from "../../http/asyncHandler";
import { authenticate, currentUser } from "../../http/auth.middleware";
import { parseWith } from "../../http/validate";
import { findUserById, listUsers, signToken } from "./auth.service";

const loginSchema = z.object({ userId: z.string().trim().min(1) });

export const authRouter = Router();

// Selector de usuarios de prueba (solo demo).
authRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    res.json({ users: await listUsers() });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { userId } = parseWith(loginSchema, req.body);
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError(401, "INVALID_USER", "Usuario no encontrado");
    }
    res.json({ token: signToken(user), user });
  }),
);

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: currentUser(req) });
});
