import { Router } from "express";
import { z } from "zod";
import {
  createRequestSchema,
  idSchema,
  optionalCommentSchema,
  rejectSchema,
} from "../../domain/rules";
import { RequestStatus } from "../../domain/types";
import { asyncHandler } from "../../http/asyncHandler";
import {
  authenticate,
  currentUser,
  requireRole,
} from "../../http/auth.middleware";
import { parseWith } from "../../http/validate";
import { queryBureau } from "../bureau/bureau.client";
import {
  TransitionAction,
  applyTransition,
  createRequest,
  getRequestForActor,
  listRequests,
  saveBureauResult,
} from "./requests.service";

const listQuerySchema = z.object({
  status: z
    .enum(["CREADA", "EN_REVISION", "APROBADA", "RECHAZADA"])
    .optional(),
});

function transitionHandler(action: TransitionAction) {
  return asyncHandler(async (req, res) => {
    const id = parseWith(idSchema, req.params.id);
    const comment =
      action === "REJECT"
        ? parseWith(rejectSchema, req.body).comment
        : (parseWith(optionalCommentSchema, req.body ?? {}).comment ?? null);

    const result = await applyTransition(currentUser(req), id, action, comment);
    res.json(result);
  });
}

export const requestsRouter = Router();

requestsRouter.use(authenticate);

requestsRouter.post(
  "/",
  requireRole("SOLICITANTE"),
  asyncHandler(async (req, res) => {
    const input = parseWith(createRequestSchema, req.body);
    const created = await createRequest(currentUser(req), input);
    res.status(201).json({ request: created });
  }),
);

requestsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status } = parseWith(listQuerySchema, req.query);
    const requests = await listRequests(
      currentUser(req),
      status as RequestStatus | undefined,
    );
    res.json({ requests });
  }),
);

requestsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseWith(idSchema, req.params.id);
    res.json({ request: await getRequestForActor(currentUser(req), id) });
  }),
);

requestsRouter.post(
  "/:id/start-review",
  requireRole("ANALISTA"),
  transitionHandler("START_REVIEW"),
);
requestsRouter.post(
  "/:id/approve",
  requireRole("ANALISTA"),
  transitionHandler("APPROVE"),
);
requestsRouter.post(
  "/:id/reject",
  requireRole("ANALISTA"),
  transitionHandler("REJECT"),
);

// Consulta al buró con reintentos. El solicitante solo puede consultar sus propias solicitudes.
requestsRouter.post(
  "/:id/bureau-check",
  asyncHandler(async (req, res) => {
    const id = parseWith(idSchema, req.params.id);
    const existing = await getRequestForActor(currentUser(req), id);
    const bureau = await queryBureau(existing.documentId);
    const request = await saveBureauResult(id, bureau.score, bureau.risk);
    res.json({ request, bureau });
  }),
);
