"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { db, asCategory, type Notice } from "@/lib/instant";
import {
  CATEGORY_STYLES,
  formatRelative,
  isNoticeVisible,
  type CategoryStyle,
} from "@/lib/categories";

const CYCLE_MS = 5_000;
const PAGE_SIZE = 4;

export default function DisplayPage() {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1219]">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="size-2 animate-pulse rounded-full bg-slate-500" />
          공지사항을 불러오는 중…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1219] px-6">
        <div className="max-w-md rounded-2xl border border-red-400/30 bg-red-400/10 px-6 py-5 text-red-200">
          <p className="text-sm font-medium">데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-xs text-red-300/80">{error.message}</p>
        </div>
      </div>
    );
  }

  const allNotices = (data.notices ?? []).filter((n) => isNoticeVisible(n, now));

  return <SignageLayout notices={allNotices} now={now} />;
}

/* ─── Layout ─── */

function SignageLayout({ notices, now }: { notices: Notice[]; now: number }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current page of notices (max 4)
  const pageNotices = notices.slice(pageOffset, pageOffset + PAGE_SIZE);
  const selected = pageNotices[currentIdx] ?? pageNotices[0] ?? null;
  const style = selected ? CATEGORY_STYLES[asCategory(selected.category)] : null;

  const advance = useCallback(() => {
    if (pageNotices.length === 0) return;
    setCurrentIdx((prev) => {
      const next = prev + 1;
      if (next >= pageNotices.length) {
        // Move to next page or wrap
        const nextPageOffset = pageOffset + PAGE_SIZE;
        if (nextPageOffset < notices.length) {
          setPageOffset(nextPageOffset);
        } else {
          setPageOffset(0);
        }
        return 0;
      }
      return next;
    });
  }, [pageNotices.length, pageOffset, notices.length]);

  const resetCycle = useCallback(() => {
    if (cycleTimer.current) clearInterval(cycleTimer.current);
    cycleTimer.current = setInterval(advance, CYCLE_MS);
  }, [advance]);

  useEffect(() => {
    resetCycle();
    return () => {
      if (cycleTimer.current) clearInterval(cycleTimer.current);
    };
  }, [resetCycle]);

  // Reset index when notices change
  useEffect(() => {
    setCurrentIdx(0);
    setPageOffset(0);
  }, [notices.length]);

  const handleSelect = (idx: number) => {
    setCurrentIdx(idx);
    resetCycle();
  };

  return (
    <div className="grid h-screen grid-cols-[40%_60%] grid-rows-[auto_1fr] overflow-hidden bg-[#0f1219]">
      <TopBar now={now} />
      <DetailPanel notice={selected} style={style} now={now} />
      <ListPanel
        notices={pageNotices}
        currentIdx={currentIdx}
        onSelect={handleSelect}
        now={now}
      />
    </div>
  );
}

/* ─── Top Bar ─── */

function TopBar({ now }: { now: number }) {
  const d = new Date(now);
  const date = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <header className="col-span-2 flex items-center justify-between border-b px-12 py-5" style={{ borderColor: "rgba(34,211,238,0.06)" }}>
      <div className="flex items-center gap-3.5">
        <Image
          src="/logo.png"
          alt="학과 로고"
          width={32}
          height={32}
          className="invert"
        />
        <div
          className="size-3 rounded-full bg-cyan-400"
          style={{
            boxShadow: "0 0 12px rgba(34,211,238,0.6)",
            animation: "livePulse 2s ease-in-out infinite",
          }}
        />
        <span className="text-xl font-extrabold text-slate-50 tracking-tight">
          게임소프트웨어학과 공지사항
        </span>
      </div>
      <div className="flex items-baseline gap-4">
        <div className="text-right text-sm text-slate-600 leading-snug">
          {date}
          <br />
          {weekday}요일
        </div>
        <span
          className="text-[44px] font-extrabold text-slate-50 leading-none tracking-tighter"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {time}
        </span>
      </div>
    </header>
  );
}

/* ─── Detail Panel (Left 40%) ─── */

function DetailPanel({
  notice,
  style,
  now,
}: {
  notice: Notice | null;
  style: CategoryStyle | null;
  now: number;
}) {
  if (!notice || !style) {
    return (
      <div className="flex items-center justify-center border-r p-12" style={{ borderColor: "rgba(34,211,238,0.04)" }}>
        <p className="text-lg text-slate-600">등록된 공지가 없습니다</p>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col justify-center overflow-hidden border-r p-12"
      style={{ borderColor: "rgba(34,211,238,0.04)" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-[30%] -top-[30%] h-[160%] w-[160%] opacity-60"
        style={{ background: style.glowGradient }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={notice.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative z-10"
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-sm font-bold ${style.badge}`}
          >
            {style.label}
          </span>

          <h2
            className="mt-5 font-extrabold text-slate-50 leading-[1.3]"
            style={{ fontSize: 36, letterSpacing: "-0.8px" }}
          >
            {notice.title}
          </h2>

          <p className="mt-4 whitespace-pre-line text-lg leading-[1.7] text-slate-400">
            {notice.content}
          </p>

          <div className="mt-6 flex items-center gap-2 text-[15px] text-slate-600">
            <span>{notice.professor}</span>
            <span className="size-1 rounded-full bg-slate-600" />
            <span>{formatRelative(notice.createdAt, now)}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── List Panel (Right 60%) ─── */

function ListPanel({
  notices,
  currentIdx,
  onSelect,
  now,
}: {
  notices: Notice[];
  currentIdx: number;
  onSelect: (idx: number) => void;
  now: number;
}) {
  return (
    <div className="flex flex-col px-8 py-8 pl-8 pr-12">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-[2px] text-slate-500">
          공지 목록
        </span>
        <div className="flex items-center gap-1.5">
          {notices.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIdx
                  ? "w-[18px] bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
                  : "w-1.5 bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2.5">
        <AnimatePresence mode="wait">
          {notices.map((notice, i) => (
            <NoticeItem
              key={notice.id}
              notice={notice}
              index={i}
              isActive={i === currentIdx}
              onSelect={() => onSelect(i)}
              now={now}
            />
          ))}
        </AnimatePresence>

        {notices.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-cyan-400/5 bg-[#1a2233]">
            <p className="text-sm text-slate-500">등록된 공지사항이 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}

function NoticeItem({
  notice,
  index,
  isActive,
  onSelect,
  now,
}: {
  notice: Notice;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  now: number;
}) {
  const cat = asCategory(notice.category);
  const style = CATEGORY_STYLES[cat];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 24,
        delay: index * 0.1,
      }}
      onClick={onSelect}
      className="relative flex flex-1 cursor-pointer items-center gap-5 overflow-hidden rounded-2xl border-2 px-7 transition-colors duration-300"
      style={{
        background: isActive ? style.activeBg : "#1a2233",
        borderColor: isActive ? style.activeBorder : "transparent",
      }}
    >
      {/* Color bar */}
      <div
        className="absolute inset-y-0 left-0 rounded-l-2xl transition-all duration-300"
        style={{
          width: isActive ? 5 : 4,
          background: style.color,
        }}
      />

      {/* Progress bar */}
      {isActive && (
        <div
          className="absolute bottom-0 left-0 h-0.5 rounded-bl-2xl"
          style={{
            background: style.progressColor,
            animation: `progressFill ${CYCLE_MS}ms linear forwards`,
          }}
          key={`progress-${notice.id}-${Date.now()}`}
        />
      )}

      {/* Badge */}
      <span
        className={`shrink-0 rounded-full border px-3 py-0.5 text-[13px] font-semibold ${style.badge}`}
      >
        {style.label}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-bold leading-snug text-slate-200 transition-colors duration-300"
          style={{
            fontSize: 28,
            letterSpacing: "-0.5px",
            color: isActive ? "#f8fafc" : undefined,
          }}
        >
          {notice.title}
        </p>
        <p className="mt-1 text-[13px] text-slate-600">
          {formatRelative(notice.createdAt, now)} · {notice.professor}
        </p>
      </div>

      {/* Arrow */}
      <span
        className="shrink-0 text-lg transition-all duration-300"
        style={{
          color: isActive ? "#64748b" : "#334155",
          transform: isActive ? "translateX(-4px)" : "none",
        }}
      >
        ◂
      </span>
    </motion.div>
  );
}
