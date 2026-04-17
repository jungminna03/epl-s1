"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db, asCategory, type Notice } from "@/lib/instant";
import {
  CATEGORY_STYLES,
  formatAbsolute,
  formatRelative,
} from "@/lib/categories";

/**
 * /display
 *
 * 복도 디스플레이 전용. InstantDB 를 실시간 구독하여
 * 공지가 추가/수정/삭제될 때 Framer Motion 으로 부드럽게 반영한다.
 *
 * 레이아웃: 상단 "긴급" 핀 영역 + 하단 일반/휴강 카드 그리드 (하이브리드).
 */
export default function DisplayPage() {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <span className="size-2 animate-pulse rounded-full bg-zinc-500" />
          공지사항을 불러오는 중…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-5 text-red-200">
          <p className="text-sm font-medium">데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs text-red-300/80">{error.message}</p>
        </div>
      </main>
    );
  }

  const notices = data.notices ?? [];
  const urgent = notices.filter((n) => asCategory(n.category) === "긴급");
  const others = notices.filter((n) => asCategory(n.category) !== "긴급");

  return (
    <main className="signage-hide-scrollbar min-h-screen overflow-y-auto">
      <DisplayHeader now={now} count={notices.length} />

      <div className="mx-auto w-full max-w-7xl px-8 pb-16">
        <UrgentSection notices={urgent} now={now} />
        <GridSection notices={others} now={now} />
        {notices.length === 0 ? <EmptyState /> : null}
      </div>
    </main>
  );
}

function DisplayHeader({ now, count }: { now: number; count: number }) {
  const d = new Date(now);
  const date = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

  return (
    <header className="sticky top-0 z-10 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="size-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
              Campus Notice
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              실시간 공지사항
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">
            {date} ({weekday}) · 등록된 공지 {count}건
          </p>
          <p className="font-mono text-3xl font-medium tabular-nums text-zinc-100">
            {time}
          </p>
        </div>
      </div>
    </header>
  );
}

function UrgentSection({ notices, now }: { notices: Notice[]; now: number }) {
  if (notices.length === 0) return null;

  return (
    <section className="pt-8">
      <SectionLabel color="text-red-400" label="긴급 공지" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {notices.map((n) => (
            <UrgentCard key={n.id} notice={n} now={now} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function GridSection({ notices, now }: { notices: Notice[]; now: number }) {
  if (notices.length === 0) return null;

  return (
    <section className="pt-10">
      <SectionLabel color="text-zinc-400" label="공지 / 휴강" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {notices.map((n) => (
            <NoticeCard key={n.id} notice={n} now={now} />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function SectionLabel({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-semibold uppercase tracking-[0.28em] ${color}`}>
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
  );
}

function UrgentCard({ notice, now }: { notice: Notice; now: number }) {
  const cat = asCategory(notice.category);
  const s = CATEGORY_STYLES[cat];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`relative overflow-hidden rounded-3xl border border-red-500/25 bg-gradient-to-br from-red-500/10 via-zinc-900 to-zinc-900 p-6 ${s.ring}`}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-red-500" />
      <div className="flex items-start justify-between gap-4">
        <Badge style={s} />
        <span className="text-xs text-zinc-500" title={formatAbsolute(notice.createdAt)}>
          {formatRelative(notice.createdAt, now)}
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-semibold leading-snug text-zinc-50">
        {notice.title}
      </h2>
      <p className="mt-3 line-clamp-4 whitespace-pre-line text-[15px] leading-relaxed text-zinc-300">
        {notice.content}
      </p>
      <p className="mt-5 text-xs text-zinc-500">
        작성: <span className="text-zinc-300">{notice.professor}</span>
      </p>
    </motion.article>
  );
}

function NoticeCard({ notice, now }: { notice: Notice; now: number }) {
  const cat = asCategory(notice.category);
  const s = CATEGORY_STYLES[cat];
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 240, damping: 28 }}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/60 p-5 backdrop-blur-sm ${s.ring}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${s.dot}`} />
      <div className="flex items-start justify-between gap-3">
        <Badge style={s} />
        <span className="text-[11px] text-zinc-500" title={formatAbsolute(notice.createdAt)}>
          {formatRelative(notice.createdAt, now)}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-zinc-50">
        {notice.title}
      </h3>
      <p className="mt-2 line-clamp-4 flex-1 whitespace-pre-line text-sm leading-relaxed text-zinc-400">
        {notice.content}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-zinc-500">
        <span>{notice.professor}</span>
        <span className="font-mono">{formatAbsolute(notice.createdAt)}</span>
      </div>
    </motion.article>
  );
}

function Badge({
  style,
}: {
  style: (typeof CATEGORY_STYLES)[keyof typeof CATEGORY_STYLES];
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${style.badge}`}
    >
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="mt-20 flex flex-col items-center justify-center gap-3 text-center">
      <div className="rounded-2xl border border-white/5 bg-zinc-900/60 px-8 py-10">
        <p className="text-sm font-medium text-zinc-300">
          등록된 공지사항이 없습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          관리자 페이지(/admin)에서 첫 공지를 작성해 보세요.
        </p>
      </div>
    </div>
  );
}
