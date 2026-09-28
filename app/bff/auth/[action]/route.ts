import { NextResponse, type NextRequest } from "next/server";
import { forwardWithRefresh, forwardedFor, serviceUrl, type TokenPair } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  EMAIL_COOKIE,
  NAME_COOKIE,
  REFRESH_COOKIE,
  clearTokens,
  relay,
  upstreamUnavailable,
  writeTokens,
} from "@/lib/server/session";
import {
  MAX_EMAIL_LENGTH,
  clearLoginAttempts,
  isAcceptablePassword,
  takeLoginAttempt,
} from "@/lib/server/loginLimit";

type Context = { params: Promise<{ action: string }> };

const PASS_THROUGH = new Set(["register", "resend-verification", "forgot-password", "reset-password"]);

// pole z nowym hasłem — tylko te akcje ustawiają hasło
const PASSWORD_FIELDS: Record<string, string> = { register: "password", "reset-password": "new_password" };

const notFound = () => NextResponse.json({ detail: "not_found" }, { status: 404 });

function parseJson(body: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

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

async function handlePost(request: NextRequest, { params }: Context) {
  const { action } = await params;
  /* Login CSRF: obca strona nie wyśle JSON-a bez preflightu CORS (którego nie obsługujemy), a formularz
     text/plain przeszedłby — i pozwalał cudzym przeglądarkom logować ofiarę na konto atakującego
     albo wyczerpać limit prób na czyimś e-mailu. Nasz klient zawsze wysyła application/json. */
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ detail: "unsupported_media_type" }, { status: 415 });
  }
  const auth = `${serviceUrl("auth")}/auth`;

  if (action === "login") {
    const body = await request.text();
    const email = String(parseJson(body).email ?? "");
    // za długi adres nie trafi do licznika — inaczej megabajtowe klucze zapchałyby pamięć
    if (email.length > MAX_EMAIL_LENGTH) return NextResponse.json({ detail: "invalid_email" }, { status: 422 });
    // to samo IP, które idzie do backendu — zaufane tylko przy BFF_TRUST_PROXY=1
    const ip = forwardedFor(request.headers)["x-forwarded-for"] ?? null;
    const blockedFor = takeLoginAttempt(email, ip);
    if (blockedFor !== null) {
      return NextResponse.json(
        { detail: "too_many_login_attempts" },
        { status: 429, headers: { "retry-after": String(blockedFor) } },
      );
    }
    const response = await postJson(`${auth}/login`, body, forwardedFor(request.headers));
    if (!response.ok) return relay(response);
    clearLoginAttempts(email, ip);
    const tokens = (await response.json()) as TokenPair;
    const name = await fetchUsername(auth, tokens.access_token);
    const out = NextResponse.json({ authenticated: true, email, name });
    writeTokens(out, tokens, { email, name });
    return out;
  }

  if (action === "logout") {
    const access = request.cookies.get(ACCESS_COOKIE)?.value;
    const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
    if (access || refresh) {
      /* Po 29 min access cookie już nie ma, a /auth/logout wymaga Bearer — bez odświeżenia
         refresh token zostałby ważny w backendzie jeszcze 7 dni. Stary refresh w body
         wystarcza: backend unieważnia całą rodzinę, łącznie z tokenem z tej rotacji.
         Wylogowanie lokalne ma się udać nawet przy niedostępnym backendzie. */
      await forwardWithRefresh({
        url: `${auth}/logout`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json", ...forwardedFor(request.headers) },
          body: JSON.stringify({ refresh_token: refresh ?? null }),
          cache: "no-store",
        },
        accessToken: access,
        refreshToken: refresh,
        refreshUrl: `${auth}/refresh`,
      }).catch(() => undefined);
    }
    const out = new NextResponse(null, { status: 204 });
    clearTokens(out);
    return out;
  }

  if (PASS_THROUGH.has(action)) {
    const body = await request.text();
    const field = PASSWORD_FIELDS[action];
    if (field && !isAcceptablePassword(parseJson(body)[field])) {
      return NextResponse.json({ detail: "weak_password" }, { status: 422 });
    }
    return relay(await postJson(`${auth}/${action}`, body, forwardedFor(request.headers)));
  }

  return notFound();
}

async function handleGet(request: NextRequest, { params }: Context) {
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

export const POST = (request: NextRequest, context: Context) =>
  handlePost(request, context).catch(upstreamUnavailable);
export const GET = (request: NextRequest, context: Context) => handleGet(request, context).catch(upstreamUnavailable);
