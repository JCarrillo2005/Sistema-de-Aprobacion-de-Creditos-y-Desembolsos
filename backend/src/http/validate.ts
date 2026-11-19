import { z } from "zod";
import { AppError } from "../domain/errors";

export function parseWith<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const flat = result.error.flatten();
    const firstMessage =
      Object.values(flat.fieldErrors).flat()[0] ??
      flat.formErrors[0] ??
      "Datos inválidos";
    throw new AppError(400, "VALIDATION_ERROR", String(firstMessage), flat);
  }
  return result.data;
}
