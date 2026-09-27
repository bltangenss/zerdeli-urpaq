import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/onest";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zerdeli Urpaq · 2026 — Олимпиадаға тіркелу",
  description: "3–4 сынып оқушыларына арналған Zerdeli Urpaq олимпиадасына тіркелу"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="kk" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
