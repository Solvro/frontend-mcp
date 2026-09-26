import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRemaining, setQuotaLock } from "./quotaLock";

describe("formatRemaining", () => {
  it.each([
    [0, "1 s"],
    [42_000, "42 s"],
    [60_000, "1 min"],
    [61_000, "2 min"],
    [3_600_000, "1 h"],
    [(12 * 60 + 40) * 60_000, "12 h 40 min"],
  ])("%i ms → %s", (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});

describe("setQuotaLock", () => {
  afterEach(() => {
    setQuotaLock(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function memoryStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    return data;
  }

  it("persists a future lock and clears it when it expires", () => {
    vi.useFakeTimers();
    const data = memoryStorage();
    setQuotaLock(Date.now() + 5_000);
    expect(data.get("gw-locked-until")).toBeDefined();
    vi.advanceTimersByTime(5_000);
    expect(data.has("gw-locked-until")).toBe(false);
  });

  it("ignores a lock that is already in the past", () => {
    const data = memoryStorage();
    setQuotaLock(Date.now() - 1);
    expect(data.has("gw-locked-until")).toBe(false);
  });
});
