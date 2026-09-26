"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  GraphMark,
  LoginIcon,
  MessageIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from "./Icons";
import { UserMenu } from "./UserMenu";
import type { ConversationGroup } from "@/lib/types";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  /** Historia rozmów pogrupowana po dacie; pusta dla trybu anonimowego. */
  conversations: ConversationGroup[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onLogin: (trigger: HTMLElement) => void;
  onLogout: () => void;
  /** Zalogowany użytkownik; `null` — tryb anonimowy albo sesja jeszcze się wczytuje. */
  email: string | null;
  /** Nazwa użytkownika z konta; `null` — pokazujemy część adresu przed `@`. */
  name: string | null;
  isAuthenticated: boolean;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
};

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onLogin,
  onLogout,
  email,
  name,
  isAuthenticated,
  isDrawerOpen,
  onCloseDrawer,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [showLoginCard, setShowLoginCard] = useState(true);
  /* Kasowanie na dwa kliknięcia: kosz zamienia się w ptaszek. Bez `confirm()`, bo blokuje
     wątek i wygląda jak alert przeglądarki, i bez modala dla jednej pozycji listy. */
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (confirmId === null) return;
    const timer = window.setTimeout(() => setConfirmId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmId]);

  /* Szuflada (< 1024 px): fokus wchodzi do środka i wraca do przycisku, który ją otworzył;
     reszta strony jest `inert` (w Landing), Escape zamyka. */
  const newChatRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isDrawerOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    newChatRef.current?.focus();
    return () => opener?.focus();
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const mobile = window.matchMedia("(max-width: 1024px)");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) onCloseDrawer();
    };
    // po poszerzeniu okna szuflady nie ma — bez tego `inert` zostałby na treści
    const onResize = () => {
      if (!mobile.matches) onCloseDrawer();
    };
    // na window, nie document: menu konta (listener na document) dostaje Escape pierwsze
    window.addEventListener("keydown", onKeyDown);
    mobile.addEventListener("change", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      mobile.removeEventListener("change", onResize);
    };
  }, [isDrawerOpen, onCloseDrawer]);

  const hasHistory = conversations.length > 0;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.title.toLowerCase().includes(q)),
    })).filter((group) => group.items.length > 0);
  }, [conversations, query]);

  return (
    <>
      {isDrawerOpen && <div className={styles.scrim} onClick={onCloseDrawer} />}

      <aside
        className={`${styles.sidebar} ${styles.drawer} ${isDrawerOpen ? styles.drawerOpen : ""}`}
        aria-label="Historia rozmów"
      >
        <Link
          href="/"
          className={styles.brand}
          aria-label="Graf Wiedzy — strona główna"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNewChat();
          }}
        >
          <span className={styles.mark}>
            <GraphMark size={20} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Graf Wiedzy</span>
            <span className={styles.brandSub}>Asystent studenta</span>
          </span>
        </Link>

        <button type="button" ref={newChatRef} className={styles.newChat} onClick={onNewChat}>
          <PlusIcon size={16} />
          Nowa rozmowa
        </button>

        {hasHistory && (
          <div className={styles.search}>
            <SearchIcon size={15} />
            <input
              className={styles.searchInput}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj w rozmowach"
              aria-label="Szukaj w rozmowach"
            />
          </div>
        )}

        <nav className={styles.history}>
          {!hasHistory && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <MessageIcon size={18} />
              </span>
              <p className={styles.emptyTitle}>Brak rozmów</p>
              <p className={styles.emptyText}>
                Zadaj pierwsze pytanie w okienku — rozmowa pojawi się tutaj.
              </p>
            </div>
          )}

          {hasHistory && groups.length === 0 && (
            <p className={styles.empty}>Brak pasujących rozmów.</p>
          )}

          {groups.map((group) => (
            <section key={group.id} className={styles.group}>
              <h2 className={styles.groupLabel}>{group.label}</h2>
              <ul className={styles.list}>
                {group.items.map((item) => {
                  const isActive = item.id === activeId;
                  const isConfirming = item.id === confirmId;
                  return (
                    <li key={item.id} className={styles.row}>
                      <button
                        type="button"
                        className={`${styles.item} ${isActive ? styles.itemActive : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => onSelect(item.id)}
                      >
                        <span className={styles.itemIcon}>
                          <MessageIcon size={14} />
                        </span>
                        <span>{item.title}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.remove} ${isConfirming ? styles.removeConfirm : ""}`}
                        aria-label={
                          isConfirming
                            ? `Potwierdź usunięcie rozmowy: ${item.title}`
                            : `Usuń rozmowę: ${item.title}`
                        }
                        onClick={() => {
                          if (!isConfirming) {
                            setConfirmId(item.id);
                            return;
                          }
                          setConfirmId(null);
                          onDelete(item.id);
                        }}
                      >
                        {isConfirming ? <CheckIcon size={13} /> : <TrashIcon size={13} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        {showLoginCard && !isAuthenticated && (
          <div className={styles.loginCard} role="note">
            <button
              type="button"
              className={styles.loginClose}
              onClick={() => setShowLoginCard(false)}
              aria-label="Zamknij"
            >
              <XIcon size={13} />
            </button>
            <p className={styles.loginText}>
              Zaloguj się, aby zapisywać historię rozmów i wracać do odpowiedzi.
            </p>
            <button
              type="button"
              className={styles.loginButton}
              onClick={(event) => onLogin(event.currentTarget)}
            >
              <LoginIcon size={15} />
              Zaloguj się
            </button>
          </div>
        )}

        {email && <UserMenu email={email} name={name} onLogout={onLogout} />}
      </aside>
    </>
  );
}
