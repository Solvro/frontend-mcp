"use client";

import { useMemo, useState } from "react";
import { GraphMark, LoginIcon, MessageIcon, PlusIcon, SearchIcon, XIcon } from "./Icons";
import { CONVERSATION_GROUPS } from "@/lib/data";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onLogin: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
};

export function Sidebar({
  activeId,
  onSelect,
  onNewChat,
  onLogin,
  isDrawerOpen,
  onCloseDrawer,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [showLoginCard, setShowLoginCard] = useState(true);

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
        <div className={styles.brand}>
          <span className={styles.mark}>
            <GraphMark size={20} />
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>Graf Wiedzy</span>
            <span className={styles.brandSub}>Asystent studenta</span>
          </span>
        </div>

        <button type="button" className={styles.newChat} onClick={onNewChat}>
          <PlusIcon size={16} />
          Nowa rozmowa
        </button>

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

        <nav className={styles.history}>
          {groups.length === 0 && <p className={styles.empty}>Brak pasujących rozmów.</p>}

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

        {showLoginCard && (
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
            <button type="button" className={styles.loginButton} onClick={onLogin}>
              <LoginIcon size={15} />
              Zaloguj się
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
