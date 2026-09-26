import { NextResponse, type NextRequest } from "next/server";
import { forwardWithRefresh, forwardedFor, serviceUrl } from "@/lib/server/backend";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearTokens, relay, writeTokens } from "@/lib/server/session";

type Context = { params: Promise<{ path: string[] }> };

// Tylko endpointy, których używa UI — reszta chat-service (np. /metrics) nie wystaje na zewnątrz.
const ALLOWED = /^api\/(chat|users\/me\/sessions|sessions\/[\w-]+(\/history|\/deactivate)?)$/;

async function handle(request: NextRequest, { params }: Context) {
  const { path } = await params;
  const target = path.join("/");
  if (!ALLOWED.test(target)) {
    return NextResponse.json({ detail: "not_found" }, { status: 404 });
  }

  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;
  const headers = new Headers({ accept: "application/json", ...forwardedFor(request.headers) });
  if (body) headers.set("content-type", "application/json");

  const { response, tokens, expired } = await forwardWithRefresh({
    url: `${serviceUrl("chat")}/${target}${request.nextUrl.search}`,
    init: { method: request.method, headers, body, cache: "no-store" },
    accessToken: request.cookies.get(ACCESS_COOKIE)?.value,
    refreshToken: request.cookies.get(REFRESH_COOKIE)?.value,
    refreshUrl: `${serviceUrl("auth")}/auth/refresh`,
  });

  const out = await relay(response);
  if (tokens) writeTokens(out, tokens);
  if (expired) clearTokens(out);
  return out;
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
