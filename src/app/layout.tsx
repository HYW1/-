import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "MARKET PULSE — 全球资金流研究台",
  description: "美股、韩股、A股资金流、K线与可审计量化信号",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
