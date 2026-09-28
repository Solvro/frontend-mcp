import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authRoute from "./auth/[action]/route";
import * as chatRoute from "./chat/[...path]/route";

type Call = { url: string; method: string; headers: Headers; body: string | null };

let calls: Call[];

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  calls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: typeof init.body === "string" ? init.body : null,
    });
    return handler(url);
  });
}

function request(path: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  const headers = { "content-type": "application/json", ...init.headers };
  return new NextRequest(`http://localhost:3000${path}`, { ...init, headers });
}

const authCtx = (action: string) => ({ params: Promise.resolve({ action }) });
const chatCtx = (...path: string[]) => ({ params: Promise.resolve({ path }) });

beforeEach(() => {
  vi.stubEnv("AUTH_SERVICE_URL", "http://auth");
  vi.stubEnv("CHAT_SERVICE_URL", "http://chat");
  vi.stubEnv("BFF_TRUST_PROXY", "1");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("chat proxy", () => {
  it("does not expose endpoints outside the allowlist", async () => {
    stubFetch(() => new Response("secret"));
    const response = await chatRoute.GET(request("/bff/chat/metrics"), chatCtx("metrics"));
    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("forwards only the proxy-appended client IP", async () => {
    stubFetch(() => Response.json({}));
    await chatRoute.GET(
      request("/bff/chat/api/users/me/sessions", { headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.7" } }),
      chatCtx("api", "users", "me", "sessions"),
    );
    expect(calls[0].headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("answers 502 problem+json when the service is unreachable", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    const response = await chatRoute.POST(
      request("/bff/chat/api/chat", { method: "POST", body: "{}" }),
      chatCtx("api", "chat"),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ detail: "upstream_unavailable" });
  });
});

describe("auth routes", () => {
  it("forwards the client IP to login so the backend limiter is per user", async () => {
    stubFetch((url) =>
      url.endsWith("/login") ? Response.json({ access_token: "a", refresh_token: "r" }) : Response.json({ username: "Ala" }),
    );
    const response = await authRoute.POST(
      request("/bff/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "ala@pwr.edu.pl", password: "x" }),
        headers: { "x-forwarded-for": "203.0.113.9" },
      }),
      authCtx("login"),
    );
    expect(response.status).toBe(200);
    expect(calls[0].headers.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("refreshes before logging out when the access cookie has expired", async () => {
    stubFetch((url) =>
      url.endsWith("/refresh")
        ? Response.json({ access_token: "fresh", refresh_token: "rotated" })
        : new Response(null, { status: 204 }),
    );
    const response = await authRoute.POST(
      request("/bff/auth/logout", { method: "POST", headers: { cookie: "gw_refresh=r-logout" } }),
      authCtx("logout"),
    );
    expect(response.status).toBe(204);
    expect(calls.map((call) => call.url)).toEqual(["http://auth/auth/refresh", "http://auth/auth/logout"]);
    expect(calls[1].headers.get("authorization")).toBe("Bearer fresh");
    expect(JSON.parse(calls[1].body ?? "{}")).toEqual({ refresh_token: "r-logout" });
    expect(response.headers.get("set-cookie")).toContain("gw_refresh=;");
  });

  it("still logs out locally when the auth service is down", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    const response = await authRoute.POST(
      request("/bff/auth/logout", { method: "POST", headers: { cookie: "gw_access=a; gw_refresh=r-down" } }),
      authCtx("logout"),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("gw_access=;");
  });

  it("answers 502 when login cannot reach the service", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    const response = await authRoute.POST(
      request("/bff/auth/login", { method: "POST", body: "{}" }),
      authCtx("login"),
    );
    expect(response.status).toBe(502);
  });

  const failedLogin = (email: string, ip: string) =>
    authRoute.POST(
      request("/bff/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "guess" }),
        headers: { "x-forwarded-for": ip },
      }),
      authCtx("login"),
    );

  it("blocks only the guessing IP, not the account owner", async () => {
    stubFetch(() => Response.json({ detail: "invalid_credentials" }, { status: 401 }));
    for (let i = 0; i < 5; i++) expect((await failedLogin("owner@pwr.edu.pl", "203.0.113.66")).status).toBe(401);

    const locked = await failedLogin("owner@pwr.edu.pl", "203.0.113.66");
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await failedLogin("owner@pwr.edu.pl", "198.51.100.1")).status).toBe(401);
  });

  it("locks an account under a guessing attack spread over many IPs", async () => {
    stubFetch(() => Response.json({ detail: "invalid_credentials" }, { status: 401 }));
    for (let i = 0; i < 50; i++) expect((await failedLogin("victim@pwr.edu.pl", `10.0.${i}.1`)).status).toBe(401);

    expect((await failedLogin("victim@pwr.edu.pl", "10.9.9.9")).status).toBe(429);
    expect(calls).toHaveLength(50);
  });

  it("counts a parallel burst and Unicode spellings of one account together", async () => {
    stubFetch(() => Response.json({ detail: "invalid_credentials" }, { status: 401 }));
    // full-width domena — backend sprowadza ją do tego samego konta
    const spellings = ["burst@pwr.edu.pl", " BURST@pwr.edu.pl", "burst@ｐｗｒ.edu.pl"];
    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        authRoute.POST(
          request("/bff/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: spellings[i % spellings.length], password: "guess" }),
          }),
          authCtx("login"),
        ),
      ),
    );
    expect(responses.filter((response) => response.status === 429)).toHaveLength(15);
    expect(calls).toHaveLength(5);
  });

  it("rejects non-JSON auth posts, which a cross-site form could send", async () => {
    stubFetch(() => Response.json({}));
    const response = await authRoute.POST(
      request("/bff/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "a@pwr.edu.pl", password: "attacker-pass" }),
        headers: { "content-type": "text/plain" },
      }),
      authCtx("login"),
    );
    expect(response.status).toBe(415);
    expect(calls).toHaveLength(0);
  });

  it("does not let a forged client IP header mint fresh counters", async () => {
    stubFetch(() => Response.json({ detail: "invalid_credentials" }, { status: 401 }));
    for (let i = 0; i < 5; i++) await failedLogin("forged@pwr.edu.pl", `not-an-ip-${i}`);
    expect((await failedLogin("forged@pwr.edu.pl", "still-not-an-ip")).status).toBe(429);
  });

  it.each([
    ["register", { username: "ala", email: "a@pwr.edu.pl", password: "short" }],
    ["reset-password", { token: "t", new_password: "x".repeat(129) }],
  ])("rejects a weak password on %s before calling the service", async (action, body) => {
    stubFetch(() => Response.json({}));
    const response = await authRoute.POST(
      request(`/bff/auth/${action}`, { method: "POST", body: JSON.stringify(body) }),
      authCtx(action),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ detail: "weak_password" });
    expect(calls).toHaveLength(0);
  });
});
