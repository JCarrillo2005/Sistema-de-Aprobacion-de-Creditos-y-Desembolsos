import { Pool, PoolClient } from "pg";
import { config } from "../config";

export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (error) => {
  console.error("Error inesperado en el pool de PostgreSQL", error);
});

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
