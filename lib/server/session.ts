import { NextResponse } from "next/server";
import type { TokenPair } from "./backend";

export const ACCESS_COOKIE = "gw_access";
export const REFRESH_COOKIE = "gw_refresh";
export const EMAIL_COOKIE = "gw_email";
export const NAME_COOKIE = "gw_name";

// Czasy życia jak w backendzie (ACCESS_TOKEN_EXPIRE_MINUTES=30, REFRESH_TOKEN_EXPIRE_DAYS=7);
// access wygasa minutę wcześniej, żeby nie wysłać tokenu na granicy ważności.
const ACCESS_MAX_AGE = 29 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const base = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/bff",
};

/** `identity` podajemy tylko przy logowaniu — odświeżenie tokenów jej nie zmienia. */
export function writeTokens(
  res: NextResponse,
  tokens: TokenPair,
  identity?: { email: string; name: string | null },
): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: REFRESH_MAX_AGE });
  if (!identity) return;
  res.cookies.set(EMAIL_COOKIE, identity.email, { ...base, maxAge: REFRESH_MAX_AGE });
  // bez nazwy kasujemy starą — inaczej zostałaby po poprzednim koncie w tej przeglądarce
  res.cookies.set(NAME_COOKIE, identity.name ?? "", { ...base, maxAge: identity.name ? REFRESH_MAX_AGE : 0 });
}

export function clearTokens(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EMAIL_COOKIE, NAME_COOKIE]) {
    res.cookies.set(name, "", { ...base, maxAge: 0 });
  }
}

const RELAYED_HEADERS = [
  "content-type",
  "retry-after",
  "x-request-id",
  // limit pytań — frontend zamyka okienko, zanim kolejne pytanie odbije się od 429
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
];

/** Przepisuje odpowiedź serwisu 1:1 (status, treść, istotne nagłówki). */
export async function relay(response: Response): Promise<NextResponse> {
  const headers = new Headers();
  for (const name of RELAYED_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  const body = response.status === 204 ? null : await response.arrayBuffer();
  return new NextResponse(body, { status: response.status, headers });
}

/** Serwis nie odpowiedział (sieć, zły JSON) — problem+json zamiast strony błędu Next. */
export function upstreamUnavailable(cause: unknown): NextResponse {
  console.error("[bff] upstream request failed", cause);
  return NextResponse.json(
    { type: "about:blank", title: "Bad Gateway", status: 502, detail: "upstream_unavailable" },
    { status: 502 },
  );
}
