"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
const CARD_GAP_VH = 1.2; // vh

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
        <div className="flex items-center gap-[0.8vw] text-slate-500">
          <span className="animate-pulse rounded-full bg-slate-500" style={{ width: "0.5vw", height: "0.5vw" }} />
          <span style={{ fontSize: "1vw" }}>공지사항을 불러오는 중…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1219]" style={{ padding: "0 2vw" }}>
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 text-red-200" style={{ padding: "1.5vh 2vw", maxWidth: "30vw" }}>
          <p className="font-medium" style={{ fontSize: "1vw" }}>데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-red-300/80" style={{ fontSize: "0.8vw" }}>{error.message}</p>
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
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = notices[currentIdx] ?? null;
  const style = selected ? CATEGORY_STYLES[asCategory(selected.category)] : null;

  const advance = useCallback(() => {
    if (notices.length === 0) return;
    setCurrentIdx((prev) => (prev + 1) % notices.length);
  }, [notices.length]);

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

  useEffect(() => {
    setCurrentIdx(0);
  }, [notices.length]);

  const handleSelect = (idx: number) => {
    setCurrentIdx(idx);
    resetCycle();
  };

  const handleSwipe = useCallback(
    (dir: number) => {
      const next = currentIdx + dir;
      if (next >= 0 && next < notices.length) {
        setCurrentIdx(next);
        resetCycle();
      }
    },
    [currentIdx, notices.length, resetCycle],
  );

  return (
    <div className="grid h-screen grid-cols-[40%_60%] grid-rows-[auto_1fr] overflow-hidden bg-[#0f1219]">
      <TopBar now={now} />
      <DetailPanel notice={selected} style={style} now={now} />
      <ListPanel
        notices={notices}
        currentIdx={currentIdx}
        onSelect={handleSelect}
        onSwipe={handleSwipe}
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
    <header
      className="col-span-2 flex items-center justify-between border-b"
      style={{ borderColor: "rgba(34,211,238,0.06)", padding: "1.5vh 3vw" }}
    >
      <div className="flex items-center" style={{ gap: "1vw" }}>
<div
          className="rounded-full bg-cyan-400"
          style={{
            width: "0.7vw",
            height: "0.7vw",
            boxShadow: "0 0 0.6vw rgba(34,211,238,0.6)",
            animation: "livePulse 2s ease-in-out infinite",
          }}
        />
        <span className="font-extrabold text-slate-50 tracking-tight" style={{ fontSize: "1.3vw" }}>
          게임소프트웨어학과 공지사항
        </span>
      </div>
      <div className="flex items-center" style={{ gap: "1vw" }}>
        <div className="text-right text-slate-600" style={{ fontSize: "0.9vw", lineHeight: 1.4 }}>
          <div>{date}</div>
          <div>{weekday}요일</div>
        </div>
        <span
          className="font-extrabold text-slate-50 leading-none tracking-tighter"
          style={{ fontSize: "2.8vw", fontVariantNumeric: "tabular-nums" }}
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
      <div
        className="flex items-center justify-center border-r"
        style={{ borderColor: "rgba(34,211,238,0.04)", padding: "3vh 3vw" }}
      >
        <p className="text-slate-600" style={{ fontSize: "1.2vw" }}>등록된 공지가 없습니다</p>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col justify-center overflow-hidden border-r"
      style={{ borderColor: "rgba(34,211,238,0.04)", padding: "3vh 3vw" }}
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
            className={`inline-flex items-center rounded-full border font-bold ${style.badge}`}
            style={{ fontSize: "0.9vw", padding: "0.3vh 1vw", gap: "0.4vw" }}
          >
            {style.label}
          </span>

          <h2
            className="font-extrabold text-slate-50 leading-[1.3]"
            style={{ fontSize: "2.4vw", letterSpacing: "-0.05vw", marginTop: "2vh" }}
          >
            {notice.title}
          </h2>

          <p
            className="whitespace-pre-line text-slate-400 leading-[1.7]"
            style={{ fontSize: "1.1vw", marginTop: "1.5vh" }}
          >
            {notice.content}
          </p>

          <div
            className="flex items-center text-slate-600"
            style={{ fontSize: "0.9vw", marginTop: "2.5vh", gap: "0.5vw" }}
          >
            <span>{notice.professor}</span>
            <span className="rounded-full bg-slate-600" style={{ width: "0.25vw", height: "0.25vw" }} />
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
  onSwipe,
  now,
}: {
  notices: Notice[];
  currentIdx: number;
  onSelect: (idx: number) => void;
  onSwipe: (direction: number) => void;
  now: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);
  const [gapPx, setGapPx] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (!viewportRef.current) return;
      const h = viewportRef.current.clientHeight;
      const gap = (window.innerHeight * CARD_GAP_VH) / 100;
      setGapPx(gap);
      setCardHeight(Math.floor((h - (PAGE_SIZE - 1) * gap) / PAGE_SIZE));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const maxOffset = Math.max(0, notices.length - PAGE_SIZE);
  const scrollOffset = Math.min(currentIdx, maxOffset);
  const translateY = -(scrollOffset * (cardHeight + gapPx));

  const dragStartY = useRef<number | null>(null);
  const isDragging = useRef(false);

  // Use document-level listeners for reliable drag tracking
  const handlePointerDown = useCallback((clientY: number) => {
    dragStartY.current = clientY;
    isDragging.current = false;
  }, []);

  const handlePointerMove = useCallback((clientY: number) => {
    if (dragStartY.current == null) return;
    if (Math.abs(dragStartY.current - clientY) > 10) {
      isDragging.current = true;
    }
  }, []);

  const handlePointerUp = useCallback((clientY: number) => {
    if (dragStartY.current == null) return;
    const delta = dragStartY.current - clientY;
    if (Math.abs(delta) > 30) {
      onSwipe(delta > 0 ? 1 : -1);
    }
    dragStartY.current = null;
  }, [onSwipe]);

  // Attach document-level mousemove/mouseup for reliable drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientY);
    const onMouseUp = (e: MouseEvent) => handlePointerUp(e.clientY);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <div className="flex flex-col overflow-hidden" style={{ padding: "2vh 3vw 2vh 2vw" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: "1.5vh" }}>
        <span className="font-bold uppercase text-slate-500" style={{ fontSize: "0.85vw", letterSpacing: "0.15vw" }}>
          공지 목록
          {notices.length > PAGE_SIZE && (
            <span className="normal-case text-slate-600" style={{ marginLeft: "0.8vw", fontSize: "0.75vw", letterSpacing: 0 }}>
              {currentIdx + 1} / {notices.length}
            </span>
          )}
        </span>
        <div className="flex items-center" style={{ gap: "0.3vw" }}>
          {notices.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === currentIdx
                  ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
                  : "bg-slate-700"
              }`}
              style={{
                height: "0.4vw",
                width: i === currentIdx ? "1.2vw" : "0.4vw",
              }}
            />
          ))}
        </div>
      </div>

      {/* Slider viewport */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-hidden"
        onWheel={(e) => {
          if (e.deltaY > 0) onSwipe(1);
          else if (e.deltaY < 0) onSwipe(-1);
        }}
        onTouchStart={(e) => handlePointerDown(e.touches[0].clientY)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientY)}
        onTouchEnd={(e) => handlePointerUp(e.changedTouches[0].clientY)}
        onMouseDown={(e) => {
          e.preventDefault();
          handlePointerDown(e.clientY);
        }}
      >
        <motion.div
          className="flex flex-col"
          style={{ gap: `${CARD_GAP_VH}vh` }}
          animate={{ y: translateY }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          {notices.map((notice, i) => (
            <NoticeItem
              key={notice.id}
              notice={notice}
              index={i}
              isActive={i === currentIdx}
              onSelect={() => {
                if (!isDragging.current) onSelect(i);
              }}
              now={now}
              height={cardHeight}
            />
          ))}
        </motion.div>
      </div>

      {notices.length === 0 && (
        <div
          className="flex flex-1 items-center justify-center rounded-2xl border border-cyan-400/5 bg-[#1a2233]"
        >
          <p className="text-slate-500" style={{ fontSize: "1vw" }}>등록된 공지사항이 없습니다</p>
        </div>
      )}
    </div>
  );
}

function NoticeItem({
  notice,
  index,
  isActive,
  onSelect,
  now,
  height,
}: {
  notice: Notice;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  now: number;
  height: number;
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
      className="relative flex cursor-pointer items-center overflow-hidden rounded-[1vw] border-2 transition-colors duration-300"
      style={{
        background: isActive ? style.activeBg : "#1a2233",
        borderColor: isActive ? style.activeBorder : "transparent",
        height,
        minHeight: height,
        padding: "0 2vw",
        gap: "1.2vw",
      }}
    >
      {/* Color bar */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-300"
        style={{
          width: isActive ? "0.35vw" : "0.25vw",
          background: style.color,
          borderRadius: "1vw 0 0 1vw",
        }}
      />

      {/* Progress bar */}
      {isActive && (
        <div
          className="absolute bottom-0 left-0"
          style={{
            height: "0.2vh",
            background: style.progressColor,
            animation: `progressFill ${CYCLE_MS}ms linear forwards`,
            borderRadius: "0 0 0 1vw",
          }}
          key={`progress-${notice.id}-${Date.now()}`}
        />
      )}

      {/* Badge */}
      <span
        className={`shrink-0 rounded-full border font-semibold ${style.badge}`}
        style={{ fontSize: "0.8vw", padding: "0.3vh 0.7vw" }}
      >
        {style.label}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-bold leading-snug text-slate-200 transition-colors duration-300"
          style={{
            fontSize: "1.6vw",
            letterSpacing: "-0.03vw",
            color: isActive ? "#f8fafc" : undefined,
          }}
        >
          {notice.title}
        </p>
        <p className="text-slate-600" style={{ fontSize: "0.8vw", marginTop: "0.3vh" }}>
          {formatRelative(notice.createdAt, now)} · {notice.professor}
        </p>
      </div>

      {/* Arrow */}
      <span
        className="shrink-0 transition-all duration-300"
        style={{
          fontSize: "1.1vw",
          color: isActive ? "#64748b" : "#334155",
          transform: isActive ? "translateX(-0.3vw)" : "none",
        }}
      >
        ◂
      </span>
    </motion.div>
  );
}
