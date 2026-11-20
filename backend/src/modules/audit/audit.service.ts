import { pool } from "../../db/pool";
import { AuditEntry, RequestStatus, Role } from "../../domain/types";

interface AuditRow {
  id: string;
  request_id: number;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: Role;
  occurred_at: Date;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  comment: string | null;
}

export async function listAudit(filters: {
  requestId?: number;
  afterId?: number;
  limit: number;
}): Promise<AuditEntry[]> {
  const result = await pool.query<AuditRow>(
    `SELECT a.id, a.request_id, a.actor_id, u.name AS actor_name,
            u.email AS actor_email, a.actor_role, a.occurred_at,
            a.from_status, a.to_status, a.comment
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
      WHERE ($1::int IS NULL OR a.request_id = $1)
        AND ($2::bigint IS NULL OR a.id > $2)
      ORDER BY a.id DESC
      LIMIT $3`,
    [filters.requestId ?? null, filters.afterId ?? null, filters.limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    requestId: row.request_id,
    actorId: row.actor_id,
    actorName: row.actor_name ?? row.actor_id,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    occurredAt: row.occurred_at.toISOString(),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    comment: row.comment,
  }));
}
