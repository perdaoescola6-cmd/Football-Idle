import type { Metadata } from "next";
import "./globals.css";
import "./retro.css";
export const metadata: Metadata = {
  title: "Football Card Manager — FutIdle V2",
  description:
    "Gerencie seu clube, descubra centenas de atletas, negocie cartas e dispute as divisões brasileiras em partidas automáticas 11v11.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
