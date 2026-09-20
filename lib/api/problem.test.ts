import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "./problem";

describe("toApiError", () => {
  it("maps backend error codes to Polish messages", () => {
    const error = toApiError(401, { detail: "invalid_credentials" }, null);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.code).toBe("invalid_credentials");
    expect(error.message).toBe("Nieprawidłowy e-mail lub hasło.");
  });

  it("uses the first validation message as code for 422", () => {
    const error = toApiError(422, { detail: [{ msg: "Value error, too long", loc: ["body"] }] }, null);
    expect(error.code).toBe("Value error, too long");
    expect(error.message).toBe("Sprawdź wpisane dane.");
  });

  it("reports minutes left on 429", () => {
    const error = toApiError(429, { detail: "Daily quota exceeded." }, "120");
    expect(error.retryAfter).toBe(120);
    expect(error.message).toBe("Limit pytań wyczerpany — spróbuj ponownie za 2 min.");
  });

  it("falls back for server errors and non-JSON bodies", () => {
    const error = toApiError(503, null, null);
    expect(error.code).toBe("unknown_error");
    expect(error.message).toBe("Serwer nie odpowiada. Spróbuj ponownie za chwilę.");
  });
});
