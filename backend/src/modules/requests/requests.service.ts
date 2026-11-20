import { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/pool";
import { AppError } from "../../domain/errors";
import {
  CreateRequestInput,
  HISTORY_WINDOW_DAYS,
} from "../../domain/rules";
import { AuthUser, CreditRequest, RequestStatus } from "../../domain/types";

interface RequestRow {
  id: number;
  applicant_id: string;
  applicant_name: string;
  document_id: string;
  monthly_income: string;
  amount: string;
  term_months: number;
  status: RequestStatus;
  rejection_reason: string | null;
  bureau_score: number | null;
  bureau_risk: string | null;
  bureau_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: RequestRow): CreditRequest {
  return {
    id: row.id,
    applicantId: row.applicant_id,
    applicantName: row.applicant_name,
    documentId: row.document_id,
    monthlyIncome: Number(row.monthly_income),
    amount: Number(row.amount),
    termMonths: row.term_months,
    status: row.status,
    rejectionReason: row.rejection_reason,
    bureauScore: row.bureau_score,
    bureauRisk: row.bureau_risk,
    bureauCheckedAt: row.bureau_checked_at
      ? row.bureau_checked_at.toISOString()
      : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function insertAudit(
  client: PoolClient,
  entry: {
    requestId: number;
    actor: AuthUser;
    fromStatus: RequestStatus | null;
    toStatus: RequestStatus;
    comment: string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (request_id, actor_id, actor_role, from_status, to_status, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.requestId,
      entry.actor.id,
      entry.actor.role,
      entry.fromStatus,
      entry.toStatus,
      entry.comment,
    ],
  );
}

interface BlockingRow {
  id: number;
  status: RequestStatus;
  created_at: Date;
}

const BLOCKING_SQL = `
  SELECT id, status, created_at
    FROM credit_requests
   WHERE document_id = $1
     AND created_at >= now() - ($2::int * interval '1 day')
     AND status IN ('CREADA', 'EN_REVISION', 'RECHAZADA')
   ORDER BY created_at DESC
   LIMIT 1`;

/** Busca una solicitud del documento que bloquee una nueva creación. */
async function findBlockingRequest(
  documentId: string,
  client?: PoolClient,
): Promise<BlockingRow | undefined> {
  const params = [documentId, HISTORY_WINDOW_DAYS];
  const result = client
    ? await client.query<BlockingRow>(BLOCKING_SQL, params)
    : await pool.query<BlockingRow>(BLOCKING_SQL, params);
  return result.rows[0];
}

interface BlockingInfo {
  message: string;
  blockingRequestId: number;
  blockingStatus: RequestStatus;
  blockingCreatedAt: string;
  blockedUntil: string | null;
}

/** Construye el motivo y las fechas del bloqueo (compartido por 409 y consulta). */
function describeBlockingRequest(
  documentId: string,
  previous: BlockingRow,
): BlockingInfo {
  const createdAt = previous.created_at;
  const availableAgain = new Date(
    createdAt.getTime() + HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  if (previous.status === "RECHAZADA") {
    return {
      message: `El documento ${documentId} tiene la solicitud #${previous.id} en estado RECHAZADA, creada el ${createdAt.toISOString()} (dentro de los últimos ${HISTORY_WINDOW_DAYS} días). Podrá volver a solicitar a partir del ${availableAgain.toISOString()}.`,
      blockingRequestId: previous.id,
      blockingStatus: previous.status,
      blockingCreatedAt: createdAt.toISOString(),
      blockedUntil: availableAgain.toISOString(),
    };
  }

  return {
    message: `El documento ${documentId} tiene la solicitud #${previous.id} en estado PENDIENTE (${previous.status}), creada el ${createdAt.toISOString()} (dentro de los últimos ${HISTORY_WINDOW_DAYS} días). Debe resolverse antes de crear otra.`,
    blockingRequestId: previous.id,
    blockingStatus: previous.status,
    blockingCreatedAt: createdAt.toISOString(),
    blockedUntil: null,
  };
}

export interface DocumentStatus {
  documentId: string;
  blocked: boolean;
  blockingRequestId?: number;
  blockingStatus?: RequestStatus;
  blockingCreatedAt?: string;
  message?: string;
  blockedUntil?: string | null;
}

/**
 * Consulta previa (no bloqueante) que usa el formulario para avisar si el
 * documento ya tiene una solicitud pendiente o un rechazo reciente. La regla
 * real se sigue aplicando dentro de la transacción de creación.
 */
export async function getDocumentStatus(
  documentId: string,
): Promise<DocumentStatus> {
  const previous = await findBlockingRequest(documentId);
  if (!previous) {
    return { documentId, blocked: false };
  }
  return {
    documentId,
    blocked: true,
    ...describeBlockingRequest(documentId, previous),
  };
}

export async function createRequest(
  actor: AuthUser,
  input: CreateRequestInput,
): Promise<CreditRequest> {
  return withTransaction(async (client) => {
    // Serializa creaciones concurrentes del mismo documento.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      input.documentId,
    ]);

    const previous = await findBlockingRequest(input.documentId, client);
    if (previous) {
      const info = describeBlockingRequest(input.documentId, previous);
      throw new AppError(409, "RECENT_HISTORY_BLOCK", info.message, {
        blockingRequestId: info.blockingRequestId,
        blockingStatus: info.blockingStatus,
        blockingCreatedAt: info.blockingCreatedAt,
        blockedUntil: info.blockedUntil,
      });
    }

    const inserted = await client.query<RequestRow>(
      `INSERT INTO credit_requests
         (applicant_id, applicant_name, document_id, monthly_income, amount, term_months, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'CREADA')
       RETURNING *`,
      [
        actor.id,
        input.applicantName,
        input.documentId,
        input.monthlyIncome,
        input.amount,
        input.termMonths,
      ],
    );

    const row = inserted.rows[0] as RequestRow;
    await insertAudit(client, {
      requestId: row.id,
      actor,
      fromStatus: null,
      toStatus: "CREADA",
      comment: "Solicitud creada",
    });

    return mapRow(row);
  });
}

export async function listRequests(
  actor: AuthUser,
  status?: RequestStatus,
): Promise<CreditRequest[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (actor.role === "SOLICITANTE") {
    params.push(actor.id);
    conditions.push(`applicant_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<RequestRow>(
    `SELECT * FROM credit_requests ${where} ORDER BY created_at DESC, id DESC`,
    params,
  );
  return result.rows.map(mapRow);
}

export async function getRequestForActor(
  actor: AuthUser,
  id: number,
): Promise<CreditRequest> {
  const result = await pool.query<RequestRow>(
    "SELECT * FROM credit_requests WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  // 404 (y no 403) para no revelar la existencia de solicitudes ajenas.
  if (!row || (actor.role === "SOLICITANTE" && row.applicant_id !== actor.id)) {
    throw new AppError(
      404,
      "REQUEST_NOT_FOUND",
      `La solicitud #${id} no existe`,
    );
  }
  return mapRow(row);
}

export type TransitionAction = "START_REVIEW" | "APPROVE" | "REJECT";

const TRANSITIONS: Record<
  TransitionAction,
  { from: RequestStatus; to: RequestStatus }
> = {
  START_REVIEW: { from: "CREADA", to: "EN_REVISION" },
  APPROVE: { from: "EN_REVISION", to: "APROBADA" },
  REJECT: { from: "EN_REVISION", to: "RECHAZADA" },
};

const DEFAULT_COMMENTS: Record<TransitionAction, string> = {
  START_REVIEW: "Solicitud tomada para revisión",
  APPROVE: "Solicitud aprobada",
  REJECT: "Solicitud rechazada",
};

export interface TransitionResult {
  request: CreditRequest;
  idempotent: boolean;
}

export async function applyTransition(
  actor: AuthUser,
  requestId: number,
  action: TransitionAction,
  comment: string | null,
): Promise<TransitionResult> {
  const { from, to } = TRANSITIONS[action];

  return withTransaction(async (client) => {
    // Bloqueo de fila: peticiones simultáneas sobre la misma solicitud se serializan aquí.
    const locked = await client.query<RequestRow>(
      "SELECT * FROM credit_requests WHERE id = $1 FOR UPDATE",
      [requestId],
    );
    const current = locked.rows[0];
    if (!current) {
      throw new AppError(
        404,
        "REQUEST_NOT_FOUND",
        `La solicitud #${requestId} no existe`,
      );
    }

    // Idempotencia: si ya está en el estado destino, se devuelve sin efectos secundarios.
    if (current.status === to) {
      return { request: mapRow(current), idempotent: true };
    }

    if (current.status !== from) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        `Transición no permitida: la solicitud #${requestId} está en ${current.status} y no puede pasar a ${to}`,
        { currentStatus: current.status, requestedStatus: to },
      );
    }

    if (action === "APPROVE") {
      const discounted = await client.query(
        `UPDATE budget
            SET available = available - $1
          WHERE id = 1 AND available >= $1
          RETURNING available`,
        [current.amount],
      );
      if (discounted.rowCount === 0) {
        const budget = await client.query<{ available: string }>(
          "SELECT available FROM budget WHERE id = 1",
        );
        throw new AppError(
          422,
          "INSUFFICIENT_BUDGET",
          `Presupuesto insuficiente: disponible ${Number(budget.rows[0]?.available ?? 0).toFixed(2)}, requerido ${Number(current.amount).toFixed(2)}`,
        );
      }
    }

    const updated = await client.query<RequestRow>(
      `UPDATE credit_requests
          SET status = $2,
              rejection_reason = $3,
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [requestId, to, action === "REJECT" ? comment : null],
    );

    await insertAudit(client, {
      requestId,
      actor,
      fromStatus: from,
      toStatus: to,
      comment: comment ?? DEFAULT_COMMENTS[action],
    });

    return {
      request: mapRow(updated.rows[0] as RequestRow),
      idempotent: false,
    };
  });
}

export async function saveBureauResult(
  requestId: number,
  score: number,
  risk: string,
): Promise<CreditRequest> {
  const result = await pool.query<RequestRow>(
    `UPDATE credit_requests
        SET bureau_score = $2, bureau_risk = $3, bureau_checked_at = now()
      WHERE id = $1
      RETURNING *`,
    [requestId, score, risk],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(
      404,
      "REQUEST_NOT_FOUND",
      `La solicitud #${requestId} no existe`,
    );
  }
  return mapRow(row);
}
