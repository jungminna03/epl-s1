"use client";

import { useEffect, useState } from "react";
import { db, type Notice } from "@/lib/instant";
import { isNoticeVisible } from "@/lib/categories";

const CLOCK_INTERVAL_MS = 30_000;

export default function WidgetPage() {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <WidgetFrame>
        <WidgetHeader now={now} />
        <EmptySlots />
      </WidgetFrame>
    );
  }

  if (error) {
    return (
      <WidgetFrame>
        <WidgetHeader now={now} />
        <ErrorBox message={error.message} />
      </WidgetFrame>
    );
  }

  const notices = (data.notices ?? []).filter((n) => isNoticeVisible(n, now));

  return (
    <WidgetFrame>
      <WidgetHeader now={now} />
      <NoticeGrid notices={notices} />
    </WidgetFrame>
  );
}

/* ─── Frame ─── */

function WidgetFrame({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "#2a2d33", padding: "1.5vh" }}
    >
      {children}
    </main>
  );
}

/* ─── Header ─── */

const VERSION_LABEL = "v0.2.0"; // package.json 의 version 과 손으로 맞춘다 (release 시 갱신)

function WidgetHeader({ now }: { now: number }) {
  const d = new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <header
      className="flex shrink-0 flex-col"
      style={{ gap: "0.4vh", paddingBottom: "1vh" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-slate-400" style={{ fontSize: "1vh" }}>
          {VERSION_LABEL}
        </span>
        <span className="text-slate-400" style={{ fontSize: "1.3vh" }}>
          {yyyy}/{mm}/{dd} ({weekday})
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span
          className="flex items-center font-bold text-white"
          style={{ gap: "0.6vh", fontSize: "1.6vh" }}
        >
          <span aria-hidden>📢</span>
          <span>게임소프트웨어학과 공지 사항</span>
        </span>
        <span
          className="font-extrabold text-white leading-none tracking-tighter"
          style={{ fontSize: "3.2vh", fontVariantNumeric: "tabular-nums" }}
        >
          {time}
        </span>
      </div>
    </header>
  );
}

/* ─── Notice Grid ─── */

const PAGE_SIZE = 4;

function NoticeGrid({ notices }: { notices: Notice[] }) {
  const pageNotices = notices.slice(0, PAGE_SIZE);

  return (
    <div
      className="grid flex-1 min-h-0"
      style={{
        gridTemplateRows: "repeat(4, 1fr)",
        gap: "1.2vh",
      }}
    >
      {Array.from({ length: PAGE_SIZE }).map((_, i) => {
        const notice = pageNotices[i];
        if (!notice) {
          return (
            <div
              key={`empty-${i}`}
              className="rounded-[1.8vh]"
              style={{ background: "rgba(74,77,85,0.25)" }}
            />
          );
        }
        return <NoticeCard key={notice.id} notice={notice} />;
      })}
    </div>
  );
}

/* ─── Notice Card ─── */

function NoticeCard({ notice }: { notice: Notice }) {
  return (
    <div
      className="relative flex items-center overflow-hidden rounded-[1.8vh]"
      style={{
        background: "#4a4d55",
        padding: "0 2.5vh",
      }}
    >
      <h3
        className="font-extrabold text-white leading-[1.15] truncate"
        style={{
          fontSize: "3.4vh",
          letterSpacing: "-0.05vh",
        }}
      >
        {notice.title}
      </h3>
    </div>
  );
}

function EmptySlots() {
  return (
    <div
      className="grid flex-1 min-h-0"
      style={{
        gridTemplateRows: "repeat(4, 1fr)",
        gap: "1.2vh",
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1.8vh]"
          style={{ background: "rgba(74,77,85,0.25)" }}
        />
      ))}
    </div>
  );
}

/* ─── Error ─── */

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center"
      style={{ padding: "1vh" }}
    >
      <div
        className="rounded-2xl border border-red-400/30 bg-red-400/10 text-red-200"
        style={{ padding: "1.5vh 2vh", maxWidth: "30vh" }}
      >
        <p className="font-medium" style={{ fontSize: "1.2vh" }}>
          데이터를 불러오지 못했습니다.
        </p>
        <p
          className="mt-1 text-red-300/80"
          style={{ fontSize: "1vh" }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
