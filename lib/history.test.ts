import { describe, expect, it } from "vitest";
import type { ConversationDto, MessageDto } from "./api/types";
import { groupConversations, parseBackendDate, titleFrom, toChatMessages } from "./history";

// Backend oddaje UTC bez "Z" — tak samo budujemy dane testowe.
const naiveUtc = (date: Date) => date.toISOString().slice(0, -1);

function conversation(id: string, updated: Date, title?: string): ConversationDto {
  return {
    session_id: id,
    user_id: "1",
    created_at: naiveUtc(updated),
    updated_at: naiveUtc(updated),
    message_count: 2,
    metadata: title ? { title } : {},
    is_active: true,
    expires_at: null,
  };
}

describe("titleFrom", () => {
  it("collapses whitespace", () => {
    expect(titleFrom("  Kiedy   zaczyna\nsię sesja? ")).toBe("Kiedy zaczyna się sesja?");
  });

  it("truncates long questions to 60 chars with an ellipsis", () => {
    const title = titleFrom("a".repeat(80));
    expect(title).toHaveLength(60);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("parseBackendDate", () => {
  it("treats zone-less timestamps as UTC", () => {
    expect(parseBackendDate("2026-09-18T10:00:00").toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });

  it("keeps explicit zones", () => {
    expect(parseBackendDate("2026-09-18T10:00:00+02:00").toISOString()).toBe("2026-09-18T08:00:00.000Z");
  });
});

describe("groupConversations", () => {
  it("buckets by local day and falls back to a default title", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const groups = groupConversations(
      [
        conversation("a", new Date(2026, 8, 18, 9, 0), "Sesja zimowa"),
        conversation("b", new Date(2026, 8, 17, 20, 0), "Urlop dziekański"),
        conversation("c", new Date(2026, 8, 14, 8, 0)),
        conversation("d", new Date(2026, 7, 1, 8, 0), "Stypendium"),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Dziś", "Wczoraj", "Ostatnie 7 dni", "Starsze"]);
    expect(groups[2].items).toEqual([{ id: "c", title: "Rozmowa bez tytułu" }]);
  });

  it("drops empty buckets", () => {
    const now = new Date(2026, 8, 18, 12, 0);
    const groups = groupConversations([conversation("a", new Date(2026, 8, 18, 9, 0), "X")], now);
    expect(groups.map((g) => g.id)).toEqual(["today"]);
  });
});

describe("toChatMessages", () => {
  it("skips system messages", () => {
    const message = (id: string, role: MessageDto["role"]): MessageDto => ({
      id,
      session_id: "s",
      role,
      content: id,
      timestamp: "2026-09-18T10:00:00",
      metadata: {},
    });
    expect(toChatMessages([message("1", "system"), message("2", "user"), message("3", "assistant")])).toEqual([
      { id: "2", role: "user", content: "2" },
      { id: "3", role: "assistant", content: "3" },
    ]);
  });
});
