import { describe, expect, it } from "vitest";
import { forwardWithRefresh, serviceUrl } from "./backend";

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

describe("forwardWithRefresh", () => {
  it("forwards anonymously without tokens", async () => {
    const { impl, calls } = fakeFetch([new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, fetchImpl: impl });
    expect(calls).toEqual([{ url: base.url, auth: null }]);
    expect(result).toMatchObject({ tokens: null, expired: false });
  });

  it("attaches the access token", async () => {
    const { impl, calls } = fakeFetch([new Response("ok")]);
    await forwardWithRefresh({ ...base, accessToken: "a1", refreshToken: "r1", fetchImpl: impl });
    expect(calls[0].auth).toBe("Bearer a1");
  });

  it("refreshes first when only the refresh token is left", async () => {
    const { impl, calls } = fakeFetch([Response.json(rotated), new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, refreshToken: "r1", fetchImpl: impl });
    expect(calls.map((c) => c.url)).toEqual([base.refreshUrl, base.url]);
    expect(calls[1].auth).toBe("Bearer new-access");
    expect(result.tokens).toEqual(rotated);
  });

  it("retries once after 401 with rotated tokens", async () => {
    const { impl, calls } = fakeFetch([unauthorized(), Response.json(rotated), new Response("ok")]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", refreshToken: "r1", fetchImpl: impl });
    expect(calls.map((c) => c.auth)).toEqual(["Bearer old", null, "Bearer new-access"]);
    expect(result.response.status).toBe(200);
    expect(result.tokens).toEqual(rotated);
  });

  it("reports an expired session when refresh fails", async () => {
    const { impl } = fakeFetch([unauthorized(), unauthorized()]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", refreshToken: "r1", fetchImpl: impl });
    expect(result.expired).toBe(true);
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toMatchObject({ detail: "session_expired" });
  });

  it("reports an expired session on 401 without a refresh token", async () => {
    const { impl } = fakeFetch([unauthorized()]);
    const result = await forwardWithRefresh({ ...base, accessToken: "old", fetchImpl: impl });
    expect(result.expired).toBe(true);
  });
});
