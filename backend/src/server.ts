import { createApp } from "./app";
import { config } from "./config";
import { migrateWithRetry } from "./db/migrate";
import { pool } from "./db/pool";

async function start(): Promise<void> {
  // En Docker la base puede tardar unos segundos en aceptar conexiones.
  await migrateWithRetry();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API escuchando en el puerto ${config.port}`);
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`${signal} recibido, cerrando servidor...`);

    const forceExit = setTimeout(() => {
      console.error("Cierre forzado por tiempo de espera");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      void pool
        .end()
        .catch((error: unknown) => {
          console.error("Error al cerrar el pool", error);
        })
        .finally(() => {
          clearTimeout(forceExit);
          process.exit(0);
        });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("No se pudo iniciar el servidor", error);
  process.exit(1);
});
