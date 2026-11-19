import { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../domain/errors";
import { AuthUser, Role } from "../domain/types";
import { findUserById } from "../modules/auth/auth.service";
import { asyncHandler } from "./asyncHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new AppError(
        401,
        "UNAUTHENTICATED",
        "Falta el token de autenticación",
      );
    }

    let subject: string;
    try {
      const payload = jwt.verify(header.slice("Bearer ".length), config.jwtSecret);
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        throw new Error("payload inválido");
      }
      subject = payload.sub;
    } catch {
      throw new AppError(401, "INVALID_TOKEN", "Token inválido o expirado");
    }

    // El rol se toma SIEMPRE de la base de datos, nunca del cliente.
    const user = await findUserById(subject);
    if (!user) {
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "El usuario del token ya no existe",
      );
    }

    req.user = user;
    next();
  },
);

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new AppError(401, "UNAUTHENTICATED", "Autenticación requerida"));
      return;
    }
    if (!roles.includes(user.role)) {
      next(
        new AppError(
          403,
          "FORBIDDEN",
          `El rol ${user.role} no tiene permiso para realizar esta acción`,
        ),
      );
      return;
    }
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, "UNAUTHENTICATED", "Autenticación requerida");
  }
  return req.user;
}
