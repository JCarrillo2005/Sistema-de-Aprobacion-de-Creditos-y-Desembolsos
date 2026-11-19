import type { Role } from "../api/types";

export function homePathFor(role: Role): string {
  return role === "ANALISTA" ? "/analyst" : "/requests";
}
