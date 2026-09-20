import type { ConversationDto, MessageDto } from "./api/types";
import type { ChatMessage, ConversationGroup } from "./types";

const TITLE_MAX = 60;
const DAY_MS = 86_400_000;

/** Tytuł rozmowy z pierwszego pytania — backend nie ma własnego pola na tytuł. */
export function titleFrom(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= TITLE_MAX) return clean;
  return `${clean.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Backend zapisuje UTC bez strefy ("2026-09-18T10:00:00") — bez "Z" JS wziąłby czas lokalny. */
export function parseBackendDate(value: string): Date {
  return new Date(/(Z|[+-]\d\d:\d\d)$/i.test(value) ? value : `${value}Z`);
}

function titleOf(conversation: ConversationDto): string {
  const title = conversation.metadata.title;
  return typeof title === "string" && title.trim() ? title : "Rozmowa bez tytułu";
}

export function groupConversations(items: ConversationDto[], now = new Date()): ConversationGroup[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const buckets = [
    { id: "today", label: "Dziś", from: today },
    { id: "yesterday", label: "Wczoraj", from: today - DAY_MS },
    { id: "week", label: "Ostatnie 7 dni", from: today - 7 * DAY_MS },
    { id: "older", label: "Starsze", from: Number.NEGATIVE_INFINITY },
  ];
  const groups: ConversationGroup[] = buckets.map(({ id, label }) => ({ id, label, items: [] }));

  for (const conversation of items) {
    const time = parseBackendDate(conversation.updated_at).getTime();
    const index = buckets.findIndex((bucket) => time >= bucket.from);
    // NaN (nieczytelna data) nie pasuje do żadnego progu — ląduje w „Starsze".
    groups[index === -1 ? groups.length - 1 : index].items.push({ id: conversation.session_id, title: titleOf(conversation) });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function toChatMessages(items: MessageDto[]): ChatMessage[] {
  return items.flatMap((message) =>
    message.role === "system" ? [] : [{ id: message.id, role: message.role, content: message.content }],
  );
}
