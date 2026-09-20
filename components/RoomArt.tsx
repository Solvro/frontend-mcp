import styles from "./Scene.module.css";

/* --------------------------------------------------------------------------
   Wnętrze dziekanatu rysowane wektorowo. Układ segregatorów jest generowany
   deterministycznie (ten sam LCG co w pliku Figma), więc serwer i klient
   renderują identyczny markup.
   -------------------------------------------------------------------------- */

type Rect = { x: number; y: number; w: number; h: number; fill: string; label?: boolean };

function makeShelfContents() {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const bind = (i: number) => `var(--bind-${i})`;
  const out: Rect[] = [];

  for (const boardY of [80, 148, 216]) {
    let x = 18;
    while (x < 230) {
      const w = 7 + Math.round(rnd() * 11);
      if (x + w > 232) break;
      const h = 36 + Math.round(rnd() * 22);
      const fill = bind(Math.floor(rnd() * 10));
      out.push({ x, y: boardY - h, w, h, fill, label: rnd() > 0.6 });
      x += w + 2;
    }
  }

  for (const boardY of [86, 175]) {
    let x = 438;
    while (x < 640) {
      const w = 8 + Math.round(rnd() * 12);
      if (x + w > 642) break;
      const h = 34 + Math.round(rnd() * 24);
      const flat = rnd() > 0.78;
      const fill = bind(Math.floor(rnd() * 10));
      if (flat) {
        out.push({ x, y: boardY - 14, w: w + 14, h: 14, fill });
        x += w + 16;
      } else {
        out.push({ x, y: boardY - h, w, h, fill, label: rnd() > 0.72 });
        x += w + 2;
      }
    }
  }

  return out;
}

const SHELF_CONTENTS = makeShelfContents();

type RoomInteriorProps = {
  /** Limit pytań wyczerpany — kot przynosi tabliczkę „CLOSED" i zostawia ją na ladzie. */
  closed?: boolean;
};

export function RoomInterior({ closed = false }: RoomInteriorProps) {
  return (
    <svg
      className={styles.roomSvg}
      viewBox="0 0 656 328"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gw-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--room-wall)" />
          <stop offset="1" stopColor="var(--room-wall-dark)" />
        </linearGradient>
        <linearGradient id="gw-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--glow)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gw-vignette" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.36" />
          <stop offset="0.42" stopColor="#000" stopOpacity="0.02" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <filter id="gw-bulb" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="gw-pool" x="-40%" y="-120%" width="180%" height="340%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="gw-cone-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="gw-steam-blur" x="-100%" y="-40%" width="300%" height="180%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>

      {/* rozmycie głębi ostrości — wnętrze jest za szybą, więc lekko nieostre */}
      <g className={styles.depthBlur}>
        <rect x="0" y="0" width="656" height="328" fill="url(#gw-wall)" />

        {/* lada */}
        <rect x="0" y="258" width="656" height="70" fill="var(--room-counter)" />
        <rect x="0" y="258" width="656" height="3" fill="var(--room-counter-top)" />

        {/* regał lewy */}
        <rect x="8" y="14" width="238" height="244" rx="2" fill="var(--room-shelf-dark)" />
        <rect x="8" y="14" width="6" height="244" fill="var(--room-shelf)" />
        <rect x="240" y="14" width="6" height="244" fill="var(--room-shelf)" />
        {[80, 148, 216].map((y) => (
          <rect key={`bl-${y}`} x="8" y={y} width="238" height="7" fill="var(--room-shelf)" />
        ))}

        {/* regał prawy */}
        <rect x="428" y="14" width="220" height="168" rx="2" fill="var(--room-shelf-dark)" />
        <rect x="428" y="14" width="6" height="168" fill="var(--room-shelf)" />
        <rect x="642" y="14" width="6" height="168" fill="var(--room-shelf)" />
        {[86, 175].map((y) => (
          <rect key={`br-${y}`} x="428" y={y} width="220" height="7" fill="var(--room-shelf)" />
        ))}

        {/* segregatory */}
        {SHELF_CONTENTS.map((r, i) => (
          <g key={`bind-${i}`}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="1" fill={r.fill} />
            {r.label ? (
              <rect
                x={r.x + 1}
                y={r.y + 6}
                width={Math.max(r.w - 2, 1)}
                height="3"
                fill="var(--room-paper)"
                opacity="0.5"
              />
            ) : null}
          </g>
        ))}

        {/* tablica ogłoszeń */}
        <rect x="268" y="64" width="140" height="124" rx="2" fill="var(--room-board)" />
        <rect
          x="268"
          y="64"
          width="140"
          height="124"
          rx="2"
          fill="var(--room-shelf)"
          opacity="0.35"
        />
        <rect x="278" y="74" width="52" height="36" fill="var(--room-paper)" opacity="0.9" transform="rotate(-2 304 92)" />
        <rect x="340" y="80" width="56" height="42" fill="var(--room-paper)" opacity="0.75" transform="rotate(1.5 368 101)" />
        <rect x="284" y="124" width="44" height="52" fill="var(--room-paper)" opacity="0.85" transform="rotate(1 306 150)" />
        <rect x="340" y="132" width="58" height="38" fill="var(--room-paper)" opacity="0.65" transform="rotate(-1.5 369 151)" />

        {/* rekwizyty na ladzie */}
        <rect x="60" y="240" width="86" height="18" rx="1" fill="var(--room-paper)" opacity="0.85" transform="rotate(-1.5 103 249)" />
        <rect x="66" y="232" width="80" height="12" rx="1" fill="var(--room-paper)" opacity="0.6" transform="rotate(1 106 238)" />
        <rect x="300" y="244" width="54" height="14" rx="1" fill="var(--room-paper)" opacity="0.7" transform="rotate(2 327 251)" />

        {/* kubek kawy na przodzie lady (para jest poza rozmyciem, niżej) */}
        <ellipse cx="161" cy="300" rx="27" ry="3.5" fill="#000" opacity="0.28" />
        <path d="M178 267 h4 a9 9 0 0 1 0 18 h-4" fill="none" stroke="var(--room-paper)" strokeWidth="5" />
        <path d="M138 258 h40 v32 a10 10 0 0 1 -10 10 h-20 a10 10 0 0 1 -10 -10 Z" fill="var(--room-paper)" />
        <path d="M178 258 v32 a10 10 0 0 1 -10 10 h-5 a10 10 0 0 0 9 -10 v-32 Z" fill="#000" opacity="0.14" />
        <ellipse cx="158" cy="258" rx="20" ry="4" fill="var(--room-paper)" />
        <ellipse cx="158" cy="258.5" rx="17" ry="3" fill="var(--coffee)" />

        {/* lampa */}
        <ellipse cx="557" cy="256" rx="29" ry="6" fill="var(--lamp)" />
        <rect x="554" y="196" width="4" height="58" fill="var(--lamp)" />
        <rect x="520" y="188" width="44" height="5" fill="var(--lamp)" transform="rotate(12 542 190)" />
        <g transform="translate(494 180)">
          <path d="M14 0 H56 L70 34 H0 Z" fill="var(--lamp)" />
          <path d="M14 0 H56 L60 10 H10 Z" fill="var(--lamp-lit)" opacity="0.25" />
        </g>
        {/* zgaszona żarówka — widać ją, gdy światło jest wyłączone */}
        <ellipse cx="532" cy="214" rx="12" ry="3.5" fill="var(--room-paper)" opacity="0.3" />

        {/* światło lampki: tylko w ciemnym motywie (--lamp-on) */}
        <g className={styles.lampLight}>
          <path d="M508 180 H550 L554 190 H504 Z" fill="var(--lamp-lit)" opacity="0.35" />
          <ellipse cx="532" cy="214" rx="28" ry="8" fill="var(--lamp-lit)" opacity="0.95" filter="url(#gw-bulb)" />

          {/* snop światła */}
          <g className={styles.screenBlend}>
            <path
              d="M490 212 H570 L680 324 H380 Z"
              fill="url(#gw-cone)"
              filter="url(#gw-cone-blur)"
            />
            <ellipse cx="540" cy="263" rx="110" ry="25" fill="var(--glow)" opacity="0.35" filter="url(#gw-pool)" />
            {[
              [470, 232, 1.5],
              [520, 206, 1],
              [560, 238, 1.25],
              [496, 252, 1],
              [610, 244, 1],
            ].map(([cx, cy, r], i) => (
              <circle key={`mote-${i}`} cx={cx} cy={cy} r={r} fill="var(--glow)" opacity="0.5" />
            ))}
          </g>
        </g>
      </g>

      {closed ? <ClosedSignCat /> : null}

      {/* para z kubka — poza rozmyciem głębi, żeby animacja nie przeliczała filtra całego pokoju */}
      <g filter="url(#gw-steam-blur)">
        {[150, 158, 166].map((x) => (
          <path
            key={`steam-${x}`}
            className={styles.steamWisp}
            d={`M${x} 251 c -6 -8 6 -14 0 -22 s -6 -14 0 -22`}
            fill="none"
            stroke="var(--room-paper)"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        ))}
      </g>

      <rect x="0" y="0" width="656" height="328" fill="url(#gw-vignette)" />
    </svg>
  );
}

/* Kot wchodzi z prawej z tabliczką w zębach, kładzie ją na ladzie i wychodzi.
   Tabliczka ma własną oś czasu: do momentu puszczenia jedzie tym samym torem co kot
   (przesunięta o długość pyska), potem zostaje na ladzie. */
function ClosedSignCat() {
  return (
    <g className={styles.depthBlur} transform="translate(0 258)" aria-hidden="true">
      <g className={styles.signCarry}>
        <ellipse className={styles.signShadow} cx="0" cy="1" rx="34" ry="3.5" fill="#000" opacity="0.28" />
        <g className={styles.signTilt}>
          <rect x="-33" y="-34" width="66" height="34" rx="2" fill="var(--room-paper)" />
          <rect x="-33" y="-34" width="66" height="4" rx="2" fill="#000" opacity="0.12" />
          <text
            x="0"
            y="-11"
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            letterSpacing="1"
            fill="var(--room-board)"
          >
            CLOSED
          </text>
        </g>
      </g>

      <g className={styles.catWalk}>
        <ellipse cx="-4" cy="1" rx="36" ry="4" fill="#000" opacity="0.26" />
        <g className={styles.catBob}>
          <g className={styles.catLegBack}>
            <rect x="12" y="-17" width="9" height="19" rx="4" fill="var(--cat-dark)" />
          </g>
          <g className={styles.catLegFront}>
            <rect x="-24" y="-17" width="9" height="19" rx="4" fill="var(--cat-dark)" />
          </g>

          <path
            className={styles.catTail}
            d="M30 -38 c 18 -4 24 -16 15 -27"
            fill="none"
            stroke="var(--cat)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <circle cx="20" cy="-27" r="17" fill="var(--cat)" />
          <rect x="-30" y="-44" width="62" height="34" rx="16" fill="var(--cat)" />

          <polygon points="-52,-54 -49,-68 -40,-57" fill="var(--cat)" />
          <polygon points="-36,-58 -30,-70 -27,-55" fill="var(--cat)" />
          <circle cx="-40" cy="-46" r="15" fill="var(--cat)" />
          <circle cx="-50" cy="-39" r="7" fill="var(--cat)" />
          <circle cx="-50" cy="-39" r="7" fill="#fff" opacity="0.14" />
          <circle cx="-44" cy="-48" r="2.3" fill="var(--lamp-lit)" />
        </g>
      </g>
    </g>
  );
}

/** Warstwa szyby: refleksy, kratka do mówienia i karteczka przyklejona od środka. */
export function GlassLayer() {
  const dots: Array<[number, number]> = [[328, 46]];
  for (const [radius, count] of [
    [10, 6],
    [19, 12],
    [27, 16],
  ] as const) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      dots.push([328 + Math.cos(a) * radius, 46 + Math.sin(a) * radius]);
    }
  }

  return (
    <svg
      className={styles.glassSvg}
      viewBox="0 0 656 328"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gw-glass-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sheen)" stopOpacity="var(--sheen-strength)" />
          <stop offset="1" stopColor="var(--sheen)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform="rotate(-28 328 164)" className={styles.sheen}>
        <rect x="60" y="-300" width="110" height="930" fill="var(--sheen)" opacity="var(--sheen-strength)" />
        <rect x="205" y="-300" width="34" height="930" fill="var(--sheen)" opacity="calc(var(--sheen-strength) * 0.7)" />
        <rect x="470" y="-300" width="60" height="930" fill="var(--sheen)" opacity="calc(var(--sheen-strength) * 0.5)" />
      </g>

      <rect x="0" y="0" width="656" height="70" fill="url(#gw-glass-top)" />

      {/* kratka do mówienia */}
      <g>
        {dots.map(([cx, cy], i) => (
          <circle key={`hole-${i}`} cx={cx} cy={cy} r="1.7" fill="#000" opacity="0.5" />
        ))}
      </g>

      {/* karteczka na szybie */}
      <g transform="rotate(-4 585 239)">
        <rect x="548" y="206" width="74" height="66" fill="var(--note)" />
        <rect x="570" y="198" width="30" height="12" fill="var(--sheen)" opacity="0.5" />
        {[
          [216, 52],
          [224, 44],
          [232, 50],
          [240, 30],
        ].map(([y, w], i) => (
          <rect key={`note-${i}`} x="557" y={y} width={w} height="3" fill="#000" opacity="0.22" />
        ))}
      </g>
    </svg>
  );
}
