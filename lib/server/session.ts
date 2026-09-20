import { NextResponse } from "next/server";
import type { TokenPair } from "./backend";

export const ACCESS_COOKIE = "gw_access";
export const REFRESH_COOKIE = "gw_refresh";
export const EMAIL_COOKIE = "gw_email";

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

export function writeTokens(res: NextResponse, tokens: TokenPair, email?: string): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...base, maxAge: ACCESS_MAX_AGE });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, { ...base, maxAge: REFRESH_MAX_AGE });
  if (email) res.cookies.set(EMAIL_COOKIE, email, { ...base, maxAge: REFRESH_MAX_AGE });
}

export function clearTokens(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EMAIL_COOKIE]) {
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
