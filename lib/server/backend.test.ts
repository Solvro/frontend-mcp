import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, forwardWithRefresh, forwardedFor, serviceUrl } from "./backend";

type Call = { url: string; auth: string | null };

function fakeFetch(responses: Response[]) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    return next;
  }) as typeof fetch;
  return { impl, calls };
}

const rotated = { access_token: "new-access", refresh_token: "new-refresh" };
const unauthorized = () => new Response(null, { status: 401 });
const base = {
  url: "http://chat/api/chat",
  init: { method: "POST", body: "{}" },
  refreshUrl: "http://auth/auth/refresh",
};

describe("serviceUrl", () => {
  it("strips the trailing slash", () => {
    expect(serviceUrl("chat", { CHAT_SERVICE_URL: "http://localhost:8001/" })).toBe("http://localhost:8001");
  });

  it("throws when the variable is missing", () => {
    expect(() => serviceUrl("auth", {})).toThrow("AUTH_SERVICE_URL");
  });
});

// Pamięć rotacji w backend.ts żyje w module — każdy test używa własnego refresh tokenu.
describe("forwardWithRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("forwards anonymously without tokens", async () => {
    const { impl, calls } = fakeFetch([new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, fetchImpl: impl });
    expect(calls).toEqual([{ url: base.url, auth: null }]);
    expect(result).toMatchObject({ tokens: null, expired: false });
  });

  it("attaches the access token", async () => {
    const { impl, calls } = fakeFetch([new Response("ok")]);
    await forwardWithRefresh({ ...base, accessToken: "a1", refreshToken: "r-attach", fetchImpl: impl });
    expect(calls[0].auth).toBe("Bearer a1");
  });

  it("refreshes first when only the refresh token is left", async () => {
    const { impl, calls } = fakeFetch([Response.json(rotated), new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, refreshToken: "r-first", fetchImpl: impl });
    expect(calls.map((c) => c.url)).toEqual([base.refreshUrl, base.url]);
    expect(calls[1].auth).toBe("Bearer new-access");
    expect(result.tokens).toEqual(rotated);
  });

  it("retries once after 401 with rotated tokens", async () => {
    const { impl, calls } = fakeFetch([unauthorized(), Response.json(rotated), new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", refreshToken: "r-retry", fetchImpl: impl });
    expect(calls.map((c) => c.auth)).toEqual(["Bearer old", null, "Bearer new-access"]);
    expect(result.response.status).toBe(200);
    expect(result.tokens).toEqual(rotated);
  });

  it("reports an expired session when refresh fails", async () => {
    const { impl } = fakeFetch([unauthorized(), unauthorized()]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", refreshToken: "r-fail", fetchImpl: impl });
    expect(result.expired).toBe(true);
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toMatchObject({ detail: "session_expired" });
  });

  it("reports an expired session on 401 without a refresh token", async () => {
    const { impl } = fakeFetch([unauthorized()]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", fetchImpl: impl });
    expect(result.expired).toBe(true);
  });

  it("shares one rotation between concurrent requests with the same refresh token", async () => {
    const { impl, calls } = fakeFetch([Response.json(rotated), new Response("a"), new Response("b")]);
    const [first, second] = await Promise.all([
      forwardWithRefresh({ ...base, refreshToken: "r-shared", fetchImpl: impl }),
      forwardWithRefresh({ ...base, refreshToken: "r-shared", fetchImpl: impl }),
    ]);
    expect(calls.filter((c) => c.url === base.refreshUrl)).toHaveLength(1);
    expect(first.tokens).toEqual(rotated);
    expect(second.tokens).toEqual(rotated);
  });

  it("keeps a successful retry cached after the failed attempt's timer fires", async () => {
    vi.useFakeTimers();
    let refreshCalls = 0;
    const impl = (async (input: RequestInfo | URL) => {
      if (String(input) !== base.refreshUrl) return new Response("ok");
      refreshCalls += 1;
      if (refreshCalls === 1) throw new Error("ECONNREFUSED");
      return Response.json(rotated);
    }) as typeof fetch;
    const options = { ...base, refreshToken: "r-retry-timer", fetchImpl: impl };
    await expect(forwardWithRefresh(options)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(20_000);
    await forwardWithRefresh(options);
    await vi.advanceTimersByTimeAsync(11_000); // pierwszy timer (30 s) już wystrzelił
    const replay = await forwardWithRefresh(options);
    expect(refreshCalls).toBe(2);
    expect(replay.tokens).toEqual(rotated);
  });

  it("does not keep a rejected refresh token in memory", async () => {
    const { impl, calls } = fakeFetch([unauthorized(), unauthorized()]);
    await forwardWithRefresh({ ...base, refreshToken: "r-garbage", fetchImpl: impl });
    await forwardWithRefresh({ ...base, refreshToken: "r-garbage", fetchImpl: impl });
    expect(calls.filter((c) => c.url === base.refreshUrl)).toHaveLength(2);
  });

  it("does not remember a refresh that failed on the network", async () => {
    let attempts = 0;
    const impl = (async (input: RequestInfo | URL) => {
      if (String(input) !== base.refreshUrl) return new Response("ok");
      attempts += 1;
      if (attempts === 1) throw new Error("ECONNREFUSED");
      return Response.json(rotated);
    }) as typeof fetch;
    await expect(forwardWithRefresh({ ...base, refreshToken: "r-flaky", fetchImpl: impl })).rejects.toThrow();
    const result = await forwardWithRefresh({ ...base, refreshToken: "r-flaky", fetchImpl: impl });
    expect(result.tokens).toEqual(rotated);
  });
});

describe("clientIp", () => {
  const ip = (init: Record<string, string>) => clientIp(new Headers(init));

  it("takes the address appended by the last proxy, not the client-supplied ones", () => {
    expect(ip({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" })).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(ip({ "x-real-ip": "203.0.113.8" })).toBe("203.0.113.8");
  });

  it("returns null without proxy headers", () => {
    expect(ip({})).toBeNull();
  });
});

describe("forwardedFor", () => {
  const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" });

  it("sends nothing unless a trusted proxy is declared", () => {
    expect(forwardedFor(headers, {})).toEqual({});
  });

  it("sends only the proxy-appended address behind a trusted proxy", () => {
    expect(forwardedFor(headers, { BFF_TRUST_PROXY: "1" })).toEqual({ "x-forwarded-for": "203.0.113.7" });
  });
});
