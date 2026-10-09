import { describe, expect, it } from "vitest";
import { AppError } from "./errors";
import { assertSameOrigin, errorResponse } from "./http";

function req(headers: Record<string, string>) {
  return new Request("http://127.0.0.1:3000/api/attachments", { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("allows requests without an Origin header", () => {
    expect(() => { assertSameOrigin(req({ host: "127.0.0.1:3000" })); }).not.toThrow();
  });

  it("allows an Origin that matches Host", () => {
    expect(() => { assertSameOrigin(req({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" })); },
    ).not.toThrow();
  });

  it("rejects a foreign Origin", () => {
    expect(() => { assertSameOrigin(req({ host: "127.0.0.1:3000", origin: "https://evil.example" })); },
    ).toThrow(AppError);
  });

  it("rejects a malformed Origin", () => {
    expect(() => { assertSameOrigin(req({ host: "127.0.0.1:3000", origin: "not a url" })); }).toThrow(AppError);
  });
});

describe("errorResponse", () => {
  it("maps AppError to its status and code with the request id", async () => {
    const res = errorResponse(new AppError("FILE_TOO_LARGE", "Too big."), "r1");
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "FILE_TOO_LARGE", message: "Too big.", requestId: "r1" },
    });
  });

  it("never exposes the message of an unexpected error", async () => {
    const res = errorResponse(new Error("ENOENT /var/secret/db"), "r2");
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain("secret");
    expect(body).toContain("r2");
  });
});
