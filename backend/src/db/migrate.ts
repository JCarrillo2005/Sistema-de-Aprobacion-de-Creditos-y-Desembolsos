import { pool } from "./pool";
import { schemaSql } from "./schema";

export async function migrate(): Promise<void> {
  await pool.query(schemaSql);
}

export async function migrateWithRetry(
  attempts = 15,
  delayMs = 1000,
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await migrate();
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.warn(
        `Base de datos no lista (intento ${attempt}/${attempts}), reintentando...`,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function run(): Promise<void> {
  try {
    await migrate();
    console.log("[db] Esquema y datos de demostración aplicados");
  } catch (error) {
    console.error("[db] Error al aplicar el esquema", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void run();
}
