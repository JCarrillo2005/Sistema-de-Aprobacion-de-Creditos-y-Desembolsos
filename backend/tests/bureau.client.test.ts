import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/domain/errors";
import { queryBureau } from "../src/modules/bureau/bureau.client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cliente del buró crediticio", () => {
  it("reintenta ante 503 y termina con éxito", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, { documentId: "DOC-1", score: 720, risk: "BAJO" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryBureau("DOC-1", {
      baseDelayMs: 1,
      baseUrl: "http://bureau.test",
    });

    expect(result.attempts).toBe(3);
    expect(result.score).toBe(720);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falla con BUREAU_UNAVAILABLE al agotar los reintentos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      queryBureau("DOC-2", {
        maxAttempts: 3,
        baseDelayMs: 1,
        baseUrl: "http://bureau.test",
      }),
    ).rejects.toMatchObject({
      code: "BUREAU_UNAVAILABLE",
      status: 503,
    } satisfies Partial<AppError>);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
