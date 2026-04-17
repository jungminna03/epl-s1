import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "캠퍼스 공지사항",
  description: "실시간 학내 공지 디스플레이",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-sans">
        {children}
      </body>
    </html>
  );
}
