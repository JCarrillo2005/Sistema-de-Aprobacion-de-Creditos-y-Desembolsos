import { z } from "zod";

const DEFAULT_JWT_SECRET = "dev-secret-cambiar";

/**
 * Configuración validada al arrancar. Si una variable es inválida, el proceso
 * falla con un mensaje claro en lugar de propagar `NaN` o cadenas vacías.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgres://credit:credit@localhost:5432/credit"),
    JWT_SECRET: z.string().min(8).default(DEFAULT_JWT_SECRET),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),

    BUREAU_BASE_URL: z.string().url().optional(),
    BUREAU_MIN_DELAY_MS: z.coerce.number().int().min(0).default(2000),
    BUREAU_MAX_DELAY_MS: z.coerce.number().int().min(0).default(4000),
    BUREAU_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.3),
    BUREAU_TIMEOUT_MS: z.coerce.number().int().min(1000).default(8000),
    BUREAU_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
    BUREAU_BACKOFF_BASE_MS: z.coerce.number().int().min(0).default(500),
  })
  .superRefine((env, ctx) => {
    if (env.BUREAU_MAX_DELAY_MS < env.BUREAU_MIN_DELAY_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BUREAU_MAX_DELAY_MS"],
        message: "debe ser mayor o igual que BUREAU_MIN_DELAY_MS",
      });
    }
    if (env.BUREAU_TIMEOUT_MS <= env.BUREAU_MAX_DELAY_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BUREAU_TIMEOUT_MS"],
        message: "debe ser mayor que BUREAU_MAX_DELAY_MS",
      });
    }
    if (
      env.NODE_ENV === "production" &&
      env.JWT_SECRET === DEFAULT_JWT_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "es obligatorio definir un secreto propio en producción",
      });
    }
  });

function fail(message: string, details: unknown): never {
  console.error(`[config] ${message}`);
  console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

const parsed = envSchema.safeParse(process.env);
const env = parsed.success
  ? parsed.data
  : fail("Variables de entorno inválidas", parsed.error.flatten().fieldErrors);

const port = env.PORT;

export const config = Object.freeze({
  env: env.NODE_ENV,
  port,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  corsOrigins: env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  bureauBaseUrl: env.BUREAU_BASE_URL ?? `http://localhost:${port}`,
  bureau: Object.freeze({
    minDelayMs: env.BUREAU_MIN_DELAY_MS,
    maxDelayMs: env.BUREAU_MAX_DELAY_MS,
    failureRate: env.BUREAU_FAILURE_RATE,
    timeoutMs: env.BUREAU_TIMEOUT_MS,
    maxAttempts: env.BUREAU_MAX_ATTEMPTS,
    backoffBaseMs: env.BUREAU_BACKOFF_BASE_MS,
  }),
  initialBudget: 50000,
});
