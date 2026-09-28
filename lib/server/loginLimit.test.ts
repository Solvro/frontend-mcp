import { describe, expect, it } from "vitest";
import { ipSource, takeLoginAttempt } from "./loginLimit";

describe("ipSource", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["2001:db8:1:2::1", "2001:db8:1:2::/64"],
    ["2001:0DB8:0001:0002:ffff:1:2:3", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["1::2:3:4:5:1.2.3.4", "1:0:2:3::/64"],
    ["not-an-ip", "unknown"],
    [null, "unknown"],
  ])("%s → %s", (ip, expected) => {
    expect(ipSource(ip)).toBe(expected);
  });

  it("shares one counter across a whole /64", () => {
    const now = 0;
    for (let i = 1; i <= 5; i++) expect(takeLoginAttempt("v6@pwr.edu.pl", `2001:db8:1:2::${i}`, now)).toBeNull();
    expect(takeLoginAttempt("v6@pwr.edu.pl", "2001:db8:1:2:ffff::9", now)).toBeGreaterThan(0);
    expect(takeLoginAttempt("v6@pwr.edu.pl", "2001:db8:1:3::1", now)).toBeNull();
  });
});
