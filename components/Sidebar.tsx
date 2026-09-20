"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GraphMark, LoginIcon, MessageIcon, PlusIcon, SearchIcon, XIcon } from "./Icons";
import { CONVERSATION_GROUPS } from "@/lib/data";
import { UserMenu } from "./UserMenu";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onLogin: (trigger: HTMLElement) => void;
  onLogout: () => void;
  /** Zalogowany użytkownik; `null` — tryb anonimowy albo sesja jeszcze się wczytuje. */
  email: string | null;
  isAuthenticated: boolean;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
};

export function Sidebar({
  activeId,
  onSelect,
  onNewChat,
  onLogin,
  onLogout,
  email,
  isAuthenticated,
  isDrawerOpen,
  onCloseDrawer,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [showLoginCard, setShowLoginCard] = useState(true);

  const hasHistory = CONVERSATION_GROUPS.length > 0;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CONVERSATION_GROUPS;
    return CONVERSATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.title.toLowerCase().includes(q)),
    })).filter((group) => group.items.length > 0);
  }, [query]);

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

        <button type="button" className={styles.newChat} onClick={onNewChat}>
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
                  return (
                    <li key={item.id}>
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

        {email && <UserMenu email={email} onLogout={onLogout} />}
      </aside>
    </>
  );
}
