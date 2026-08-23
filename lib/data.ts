import type { ConversationGroup } from "./types";

/**
 * Historia rozmów. Pusta — nowy użytkownik nie ma jeszcze żadnej rozmowy.
 * TODO: podmienić na fetch z API historii (MCP + warstwa ML).
 */
export const CONVERSATION_GROUPS: ConversationGroup[] = [];

export const SUGGESTIONS = [
  "Kiedy zaczyna się sesja?",
  "Ile ECTS na zaliczenie semestru?",
  "Jak złożyć podanie o urlop?",
  "Terminy zapisów na kursy",
];
