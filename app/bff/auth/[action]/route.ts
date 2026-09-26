import { NextResponse, type NextRequest } from "next/server";
import { forwardedFor, serviceUrl, type TokenPair } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  EMAIL_COOKIE,
  NAME_COOKIE,
  REFRESH_COOKIE,
  clearTokens,
  relay,
  writeTokens,
} from "@/lib/server/session";

type Context = { params: Promise<{ action: string }> };

const PASS_THROUGH = new Set(["register", "resend-verification", "forgot-password", "reset-password"]);

const notFound = () => NextResponse.json({ detail: "not_found" }, { status: 404 });

function postJson(url: string, body: string, headers: HeadersInit = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    cache: "no-store",
  });
}

/* Nazwa użytkownika z `/auth/me` — zapisujemy ją w ciasteczku przy logowaniu, więc
   zmiana nazwy na koncie pokaże się dopiero po ponownym zalogowaniu. Gdyby to zaczęło
   przeszkadzać, `session` może pytać `/auth/me` przez forwardWithRefresh. */
async function fetchUsername(auth: string, access: string): Promise<string | null> {
  const response = await fetch(`${auth}/me`, {
    headers: { authorization: `Bearer ${access}` },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const profile = (await response.json().catch(() => null)) as { username?: string } | null;
  return profile?.username?.trim() || null;
}

export async function POST(request: NextRequest, { params }: Context) {
  const { action } = await params;
  const auth = `${serviceUrl("auth")}/auth`;

  if (action === "login") {
    const body = await request.text();
    const response = await postJson(`${auth}/login`, body, forwardedFor(request.headers));
    if (!response.ok) return relay(response);
    const tokens = (await response.json()) as TokenPair;
    const { email } = JSON.parse(body) as { email: string };
    const name = await fetchUsername(auth, tokens.access_token);
    const out = NextResponse.json({ authenticated: true, email, name });
    writeTokens(out, tokens, { email, name });
    return out;
  }

  if (action === "logout") {
    const access = request.cookies.get(ACCESS_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value ?? null;
    if (access) {
      // Wylogowanie lokalne ma się udać nawet przy niedostępnym backendzie.
      await postJson(`${auth}/logout`, JSON.stringify({ refresh_token: refresh }), {
        ...forwardedFor(request.headers),
        authorization: `Bearer ${access}`,
      }).catch(() => undefined);
    }
    const out = new NextResponse(null, { status: 204 });
    clearTokens(out);
    return out;
  }

  if (PASS_THROUGH.has(action)) {
    return relay(await postJson(`${auth}/${action}`, await request.text(), forwardedFor(request.headers)));
  }

  return notFound();
}

export async function GET(request: NextRequest, { params }: Context) {
  const { action } = await params;

  if (action === "session") {
    const authenticated = request.cookies.has(REFRESH_COOKIE);
    const email = authenticated ? (request.cookies.get(EMAIL_COOKIE)?.value ?? null) : null;
    const name = authenticated ? (request.cookies.get(NAME_COOKIE)?.value ?? null) : null;
    return NextResponse.json({ authenticated, email, name });
  }

  if (action === "verify") {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const url = `${serviceUrl("auth")}/auth/verify?token=${encodeURIComponent(token)}`;
    return relay(await fetch(url, { headers: forwardedFor(request.headers), cache: "no-store" }));
  }

  return notFound();
}
