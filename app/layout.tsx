import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Graf Wiedzy — asystent studenta PWR",
  description:
    "Zapytaj o regulaminy, terminy, zapisy i stypendia. Odpowiedzi z odnośnikami do dokumentów Politechniki Wrocławskiej.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2ece2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e131e" },
  ],
};

/** Ustawia motyw przed pierwszym malowaniem — bez tego mignąłby jasny motyw. */
const themeScript = `try{var t=localStorage.getItem("gw-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
