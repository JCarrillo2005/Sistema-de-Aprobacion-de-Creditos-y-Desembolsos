const API_BASE = "/api";
const TOKEN_KEY = "credit-app.token";

// Solo se guarda el token. El rol NUNCA se persiste ni se confía en él desde el cliente:
// siempre se obtiene de /auth/me, que lo lee de la base de datos.
export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Sin almacenamiento disponible: la sesión durará hasta recargar.
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nada que limpiar.
    }
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface ParsedError {
  code: string;
  message: string;
  details?: unknown;
}

function readError(payload: unknown, _status: number): ParsedError {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const inner = (payload as { error: unknown }).error;
    if (typeof inner === "object" && inner !== null) {
      const { code, message, details } = inner as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
      };
      return {
        code: typeof code === "string" ? code : "UNKNOWN_ERROR",
        message: typeof message === "string" ? message : "Error inesperado",
        details,
      };
    }
  }
  return {
    code: "UNKNOWN_ERROR",
    message: "No pudimos completar la operación. Intenta nuevamente.",
  };
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "No pudimos conectar con el servicio. Revisa tu conexión e intenta nuevamente.",
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const parsed = readError(payload, response.status);
    if (response.status === 401 && token && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(
      response.status,
      parsed.code,
      parsed.message,
      parsed.details,
    );
  }

  return payload as T;
}
