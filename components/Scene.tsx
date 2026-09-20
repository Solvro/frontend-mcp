"use client";

import { ViewTransition, useEffect, useState, type ReactNode } from "react";
import { GlassLayer, RoomInterior } from "./RoomArt";
import styles from "./Scene.module.css";

type SceneProps = {
  /** Pierwszy plan — opiera się na parapecie okienka. */
  children: ReactNode;
  /** Wszystko poniżej pierwszego planu (podpowiedzi, stopka). */
  below?: ReactNode;
  /** Trwająca rozmowa — okienko schodzi do tła, a wątek przewija się „przez szybę”. */
  conversation?: ReactNode;
  /** Limit pytań wyczerpany — w pokoju pojawia się kot z tabliczką „CLOSED". */
  closed?: boolean;
};

/* Okienko i pole pytania to te same obiekty w obu układach — przy wejściu w rozmowę
   (startTransition w Landing) przejeżdżają na nowe miejsce zamiast przeskakiwać. */
function WindowFrame({ closed }: { closed?: boolean }) {
  return (
    <ViewTransition name="gw-window" default="none" share="gw-morph" update="gw-morph">
      <div className={styles.frame}>
        <div className={styles.plaque}>DZIEKANAT · OKIENKO 1</div>

        <div className={styles.window}>
          <div className={styles.reveal}>
            <div className={styles.room}>
              <RoomInterior closed={closed} />
              <GlassLayer />
            </div>
          </div>
        </div>

        <div className={styles.sill} />
        <div className={styles.sillFace} />
      </div>
    </ViewTransition>
  );
}

function Foreground({ children }: { children: ReactNode }) {
  return (
    <ViewTransition name="gw-composer" default="none" share="gw-morph" update="gw-morph">
      <div className={styles.overlap}>{children}</div>
    </ViewTransition>
  );
}

export function Scene({ children, below, conversation, closed }: SceneProps) {
  if (conversation !== undefined) {
    return (
      <ConversationScene below={below} conversation={conversation} closed={closed}>
        {children}
      </ConversationScene>
    );
  }

  return (
    <div className={styles.stage}>
      <div className={styles.glow} aria-hidden="true" />

      <ViewTransition default="none" exit="gw-fade-out" enter="gw-fade-in">
        <div className={styles.greeting}>
          <p className={styles.eyebrow}>Asystent studenta · Politechnika Wrocławska</p>
          <h1 className={styles.heading}>Dzień dobry. Czym mogę służyć?</h1>
          <p className={styles.subtitle}>
            Pytaj o regulaminy, terminy, zapisy i stypendia — odpowiem i pokażę, z którego dokumentu
            to wynika.
          </p>
        </div>
      </ViewTransition>

      <div className={styles.sceneWrap}>
        <WindowFrame closed={closed} />
        <Foreground>{children}</Foreground>
      </div>

      {below}
    </div>
  );
}

/** Jak długo po wejściu w rozmowę wątek ma własną warstwę w view transition. */
const THREAD_ENTER_MS = 1200;

function ConversationScene({ children, below, conversation, closed }: SceneProps) {
  /* Cała scena rozmowy montuje się w jednym transition, więc React nie odpali `enter`
     zagnieżdżonego <ViewTransition> — wątek trafiłby do zrzutu tła, POD przejeżdżające okienko.
     Dlatego na czas wejścia wątek dostaje własną view-transition-name — inline, bo CSS Modules
     haszowałby nazwę i selektory ::view-transition-*(gw-thread) w globals.css by jej nie złapały. */
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setEntering(false), THREAD_ENTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${styles.stage} ${styles.chatting}`}>
      <div className={styles.glow} aria-hidden="true" />

      {/* nieruchome tło: okienko na środku, niezależne od wątku i pola pytania */}
      <div className={styles.backdrop} aria-hidden="true">
        <WindowFrame closed={closed} />
      </div>

      <div
        className={styles.threadScroll}
        style={entering ? { viewTransitionName: "gw-thread" } : undefined}
      >
        <div className={styles.threadInner}>{conversation}</div>
      </div>

      <div className={styles.dock}>
        <Foreground>{children}</Foreground>
        {below}
      </div>
    </div>
  );
}
