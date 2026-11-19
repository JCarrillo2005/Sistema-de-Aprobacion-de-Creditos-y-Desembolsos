import jwt from "jsonwebtoken";
import { config } from "../../config";
import { pool } from "../../db/pool";
import { AuthUser, Role } from "../../domain/types";

interface UserRow {
  id: string;
  name: string;
  role: Role;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const result = await pool.query<UserRow>(
    "SELECT id, name, role FROM users WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, name: row.name, role: row.role } : null;
}

export async function listUsers(): Promise<AuthUser[]> {
  const result = await pool.query<UserRow>(
    "SELECT id, name, role FROM users ORDER BY role, name",
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
  }));
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ name: user.name, role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: 60 * 60 * 8,
  });
}
