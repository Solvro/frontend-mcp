import type { ConversationGroup } from "./types";

/**
 * Dane poglądowe. Docelowo pochodzą z backendu (MCP + warstwa ML).
 * TODO: podmienić na fetch z API historii rozmów.
 */
export const CONVERSATION_GROUPS: ConversationGroup[] = [
  {
    id: "today",
    label: "Dzisiaj",
    items: [
      { id: "c1", title: "Wymagania na obronę" },
      { id: "c2", title: "Stypendium rektora — punkty" },
      { id: "c3", title: "Zapisy na WF" },
    ],
  },
  {
    id: "week",
    label: "7 dni temu",
    items: [
      { id: "c4", title: "Analiza 2 — zakres egzaminu" },
      { id: "c5", title: "Praktyki — jak zaliczyć?" },
      { id: "c6", title: "Przelicznik ocen Erasmus" },
    ],
  },
  {
    id: "older",
    label: "Wcześniej",
    items: [
      { id: "c7", title: "Podanie o urlop dziekański" },
      { id: "c8", title: "Terminy sesji poprawkowej" },
    ],
  },
];

export const SUGGESTIONS = [
  "Kiedy zaczyna się sesja?",
  "Ile ECTS na zaliczenie semestru?",
  "Jak złożyć podanie o urlop?",
  "Terminy zapisów na kursy",
];
