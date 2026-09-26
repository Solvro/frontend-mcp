import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { NAME_COOKIE, writeTokens } from "./session";

const tokens = { access_token: "a", refresh_token: "r" };

describe("writeTokens", () => {
  it("stores the account name on login", () => {
    const res = NextResponse.json({});
    writeTokens(res, tokens, { email: "a@pwr.edu.pl", name: "Ala" });
    expect(res.cookies.get(NAME_COOKIE)?.value).toBe("Ala");
  });

  it("clears a previous account's name when the new login has none", () => {
    const res = NextResponse.json({});
    writeTokens(res, tokens, { email: "b@pwr.edu.pl", name: null });
    expect(res.headers.get("set-cookie")).toMatch(/gw_name=;.*Max-Age=0/);
  });

  it("leaves identity cookies alone on a token refresh", () => {
    const res = NextResponse.json({});
    writeTokens(res, tokens);
    expect(res.cookies.get(NAME_COOKIE)).toBeUndefined();
  });
});
