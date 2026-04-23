"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db, type Notice } from "@/lib/instant";
import {
  CATEGORY_STYLES,
  DEFAULT_STYLE,
  formatRelative,
  isNoticeVisible,
  parseCategories,
  type CategoryStyle,
} from "@/lib/categories";
import { fireCheckEffect } from "@/lib/check-effects";

const CYCLE_MS = 10_000;
const RETURN_MS = 60_000;
const PAGE_SIZE = 4;

const SPRING = { type: "spring" as const, stiffness: 200, damping: 25 };

function getCheckCount(notice: Notice): number {
  return (notice as Notice & { checkCount?: number }).checkCount ?? 0;
}

/* ─── Data Fetching (default export) ─── */

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
        <div className="flex items-center gap-[0.8vh] text-slate-500">
          <span
            className="animate-pulse rounded-full bg-slate-500"
            style={{ width: "0.5vh", height: "0.5vh" }}
          />
          <span style={{ fontSize: "1vh" }}>공지사항을 불러오는 중…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-[#0f1219]"
        style={{ padding: "0 2vh" }}
      >
        <div
          className="rounded-2xl border border-red-400/30 bg-red-400/10 text-red-200"
          style={{ padding: "1.5vh 2vh", maxWidth: "30vh" }}
        >
          <p className="font-medium" style={{ fontSize: "1vh" }}>
            데이터를 불러오지 못했습니다.
          </p>
          <p className="mt-1 text-red-300/80" style={{ fontSize: "0.8vh" }}>
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  const allNotices = (data.notices ?? []).filter((n) => isNoticeVisible(n, now));

  return <SignageLayout notices={allNotices} now={now} />;
}

/* ─── Layout ─── */

function SignageLayout({ notices, now }: { notices: Notice[]; now: number }) {
  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const [pageIdx, setPageIdx] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Keep pageIdx in range when notices change
  useEffect(() => {
    setPageIdx((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  // --- Page cycle timer (only in grid state) ---
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCycle = useCallback(() => {
    if (cycleRef.current) clearInterval(cycleRef.current);
    cycleRef.current = setInterval(() => {
      slideDirection.current = 1;
      setPageIdx((p) => (p + 1) % Math.max(1, totalPages));
    }, CYCLE_MS);
  }, [totalPages]);

  const stopCycle = useCallback(() => {
    if (cycleRef.current) {
      clearInterval(cycleRef.current);
      cycleRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!expandedId) {
      startCycle();
    } else {
      stopCycle();
    }
    return stopCycle;
  }, [expandedId, startCycle, stopCycle]);

  // --- Fullscreen return timer ---
  const returnRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetReturnTimer = useCallback(() => {
    if (returnRef.current) clearTimeout(returnRef.current);
    returnRef.current = setTimeout(() => {
      setExpandedId(null);
    }, RETURN_MS);
  }, []);

  const clearReturnTimer = useCallback(() => {
    if (returnRef.current) {
      clearTimeout(returnRef.current);
      returnRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (expandedId) {
      resetReturnTimer();
    } else {
      clearReturnTimer();
    }
    return clearReturnTimer;
  }, [expandedId, resetReturnTimer, clearReturnTimer]);

  const handleInteraction = useCallback(() => {
    if (expandedId) resetReturnTimer();
  }, [expandedId, resetReturnTimer]);

  const handleClose = useCallback(() => {
    setExpandedId(null);
  }, []);

  const handleTileClick = useCallback(
    (id: string) => {
      setExpandedId(id);
    },
    [],
  );

  // --- Swipe direction for slide animation ---
  const slideDirection = useRef(1); // 1 = forward (left), -1 = backward (right)

  // --- Drag-based swipe to change page ---
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (expandedId) return;
      const { offset, velocity } = info;
      // Swipe threshold: either dragged far enough or flicked fast enough
      const swipe = Math.abs(offset.x) * 0.5 + Math.abs(velocity.x) * 0.3;
      if (swipe > 40) {
        if (offset.x < 0 && pageIdx < totalPages - 1) {
          slideDirection.current = 1;
          setPageIdx((p) => p + 1);
        } else if (offset.x > 0 && pageIdx > 0) {
          slideDirection.current = -1;
          setPageIdx((p) => p - 1);
        }
      }
    },
    [expandedId, pageIdx, totalPages],
  );

  // Current page of notices
  const pageNotices = notices.slice(pageIdx * PAGE_SIZE, pageIdx * PAGE_SIZE + PAGE_SIZE);
  const expandedNotice = expandedId
    ? notices.find((n) => n.id === expandedId) ?? null
    : null;

  return (
    <div
      className="flex items-center justify-center overflow-hidden bg-[#0f1219]"
      style={{ width: "100vw", height: "100vh" }}
    >
      {/* 1:1 square container */}
      <div
        className="relative flex flex-col"
        style={{
          width: "min(100vw, 100vh)",
          height: "min(100vw, 100vh)",
        }}
      >
        <TopBar now={now} />

        {/* Content area: grid + overlay */}
        <div
          className="relative flex-1 min-h-0 overflow-hidden"
          style={{ padding: "1.5vh" }}
        >
          {/* 1×4 Grid */}
          <AnimatePresence initial={false} mode="popLayout" custom={slideDirection.current}>
            <motion.div
              key={pageIdx}
              className="grid h-full"
              style={{
                gridTemplateColumns: "1fr",
                gridTemplateRows: "repeat(4, 1fr)",
                gap: "1.5vh",
              }}
              custom={slideDirection.current}
              initial="enter"
              animate="center"
              exit="exit"
              variants={{
                enter: (dir: number) => ({ x: `${dir * 105}%`, opacity: 0.5 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: number) => ({ x: `${dir * -105}%`, opacity: 0.5 }),
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              drag={expandedId ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={handleDragEnd}
            >
              {Array.from({ length: PAGE_SIZE }).map((_, i) => {
                const notice = pageNotices[i];
                if (!notice) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="rounded-[1.5vh]"
                      style={{
                        border: "1px solid rgba(148,163,184,0.06)",
                        background: "rgba(30,34,51,0.3)",
                      }}
                    />
                  );
                }
                return (
                  <GridTile
                    key={notice.id}
                    notice={notice}
                    now={now}
                    onClick={() => handleTileClick(notice.id)}
                    dimmed={!!expandedId}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Ghost grid borders (visible when expanded) */}
          <AnimatePresence>
            {expandedId && (
              <motion.div
                className="absolute inset-0 grid pointer-events-none"
                style={{
                  gridTemplateColumns: "1fr",
                  gridTemplateRows: "repeat(4, 1fr)",
                  gap: "1.5vh",
                  padding: "1.5vh",
                  zIndex: 10,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[1.5vh]"
                    style={{
                      border: "1px solid rgba(148,163,184,0.15)",
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expanded overlay */}
          <AnimatePresence>
            {expandedNotice && (
              <ExpandedTile
                key={expandedNotice.id}
                notice={expandedNotice}
                now={now}
                onClose={handleClose}
                onInteraction={handleInteraction}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Page indicator */}
        {totalPages > 1 && (
          <PageIndicator
            total={totalPages}
            current={pageIdx}
          />
        )}
      </div>
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
      className="flex shrink-0 items-center justify-between border-b"
      style={{ borderColor: "rgba(34,211,238,0.06)", padding: "1.5vh 3vh" }}
    >
      <div className="flex items-center" style={{ gap: "1vh" }}>
        <div
          className="rounded-full bg-cyan-400"
          style={{
            width: "0.7vh",
            height: "0.7vh",
            boxShadow: "0 0 0.6vh rgba(34,211,238,0.6)",
            animation: "livePulse 2s ease-in-out infinite",
          }}
        />
        <span style={{ fontSize: "2.2vh", letterSpacing: "0.02vh" }}>
          <span
            className="font-extrabold"
            style={{
              background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 0.8vh rgba(96,165,250,0.4))",
            }}
          >
            게임소프트웨어학과
          </span>
          <span
            className="font-light text-slate-400"
            style={{ marginLeft: "0.5vh", fontSize: "0.85em" }}
          >
            공지사항
          </span>
        </span>
      </div>
      <div className="flex items-center" style={{ gap: "1vh" }}>
        <div
          className="text-right text-slate-600"
          style={{ fontSize: "1.3vh", lineHeight: 1.4 }}
        >
          <div>{date}</div>
          <div>{weekday}요일</div>
        </div>
        <span
          className="font-extrabold text-slate-50 leading-none tracking-tighter"
          style={{ fontSize: "3.8vh", fontVariantNumeric: "tabular-nums" }}
        >
          {time}
        </span>
      </div>
    </header>
  );
}

/* ─── Grid Tile ─── */

function GridTile({
  notice,
  now,
  onClick,
  dimmed,
}: {
  notice: Notice;
  now: number;
  onClick: () => void;
  dimmed: boolean;
}) {
  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const dbCount = getCheckCount(notice);

  return (
    <motion.div
      layoutId={`tile-${notice.id}`}
      onClick={onClick}
      className="relative flex items-center cursor-pointer overflow-hidden rounded-[1.5vh]"
      style={{
        background: "#1a2233",
        border: `1px solid rgba(148,163,184,0.08)`,
        padding: "1.5vh 2.5vh 1.5vh 3vh",
        gap: "2vh",
        opacity: dimmed ? 0.3 : 1,
        transition: "opacity 0.2s",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
    >
      {/* Left color bar */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: "0.5vh",
          background: style.color,
          borderRadius: "1.5vh 0 0 1.5vh",
        }}
      />

      {/* Category badge */}
      {cats.length > 0 && (
        <div className="flex shrink-0 flex-col" style={{ gap: "0.4vh" }}>
          {cats.map((c) => {
            const cs = CATEGORY_STYLES[c];
            return (
              <span
                key={c}
                className={`inline-flex items-center justify-center rounded-full border font-bold ${cs.badge}`}
                style={{ fontSize: "1.2vh", padding: "0.3vh 1.2vh" }}
              >
                {cs.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Title + summary */}
      <div className="min-w-0 flex-1">
        <h3
          className="font-extrabold text-slate-50 leading-[1.25] truncate"
          style={{
            fontSize: "2.4vh",
            letterSpacing: "-0.03vh",
          }}
        >
          {notice.title}
        </h3>
        {notice.content && (
          <p
            className="text-slate-400 leading-[1.4] truncate"
            style={{
              fontSize: "1.3vh",
              marginTop: "0.4vh",
            }}
          >
            {notice.content}
          </p>
        )}
      </div>

      {/* Right: time + check count */}
      <div className="flex shrink-0 flex-col items-end" style={{ gap: "0.3vh" }}>
        <span className="text-slate-600" style={{ fontSize: "1.1vh" }}>
          {formatRelative(notice.createdAt, now)}
        </span>
        {dbCount > 0 && (
          <span
            className="flex items-center text-slate-500"
            style={{ gap: "0.3vh", fontSize: "1.1vh" }}
          >
            <span>✓</span>
            <span>{dbCount}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Expanded Tile ─── */

function ExpandedTile({
  notice,
  now,
  onClose,
  onInteraction,
}: {
  notice: Notice;
  now: number;
  onClose: () => void;
  onInteraction: () => void;
}) {
  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const [showIframe, setShowIframe] = useState(false);

  // --- Overscroll-to-close (touch + mouse) ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const overscrollStart = useRef<{ x: number; y: number; atTop: boolean; atBottom: boolean } | null>(null);

  const captureStart = useCallback((x: number, y: number) => {
    onInteraction();
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    overscrollStart.current = { x, y, atTop, atBottom };
  }, [onInteraction]);

  const captureEnd = useCallback((x: number, y: number) => {
    if (!overscrollStart.current) return;
    const start = overscrollStart.current;
    overscrollStart.current = null;

    const dx = x - start.x;
    const dy = y - start.y;
    const THRESHOLD = 60;

    // Horizontal overscroll (always counts — no horizontal scroll)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESHOLD) {
      onClose();
      return;
    }
    // Vertical overscroll at edges
    if (start.atTop && dy > THRESHOLD) {
      onClose();
      return;
    }
    if (start.atBottom && dy < -THRESHOLD) {
      onClose();
    }
  }, [onClose]);

  const linkDomain = notice.link
    ? (() => {
        try {
          return new URL(notice.link).hostname;
        } catch {
          return notice.link;
        }
      })()
    : null;

  // iframe mode
  if (showIframe && notice.link) {
    return (
      <motion.div
        layoutId={`tile-${notice.id}`}
        className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-[1.5vh]"
        style={{ background: "#0f1219" }}
        transition={SPRING}
      >
        {/* Back bar */}
        <button
          onClick={() => {
            setShowIframe(false);
            onInteraction();
          }}
          className="flex shrink-0 items-center border-b bg-[#1a2233] text-slate-400 transition-colors hover:text-slate-200"
          style={{
            borderColor: "rgba(34,211,238,0.06)",
            padding: "1vh 2vh",
            gap: "0.5vh",
            fontSize: "1.2vh",
          }}
        >
          <span style={{ fontSize: "1.4vh" }}>←</span>
          공지로 돌아가기
        </button>
        <iframe
          src={notice.link}
          className="flex-1 bg-white"
          style={{ border: "none", width: "100%", height: "100%" }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layoutId={`tile-${notice.id}`}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-[1.5vh]"
      style={{ background: "#0f1219" }}
      transition={SPRING}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-[30%] -top-[30%] h-[160%] w-[160%] opacity-60"
        style={{ background: style.glowGradient }}
      />

      {/* X close button */}
      <button
        onClick={onClose}
        className="absolute z-30 flex items-center justify-center rounded-full"
        style={{
          top: "1.5vh",
          right: "1.5vh",
          width: "4vh",
          height: "4vh",
          background: "rgba(248,250,252,0.08)",
          border: "1px solid rgba(248,250,252,0.15)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      >
        <svg
          width="40%"
          height="40%"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ padding: "3vh" }}
        onScroll={onInteraction}
        onTouchStart={(e) => captureStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={(e) => captureEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
        onMouseDown={(e) => captureStart(e.clientX, e.clientY)}
        onMouseUp={(e) => captureEnd(e.clientX, e.clientY)}
      >
        {/* Category badges */}
        {cats.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: "0.5vh" }}>
            {cats.map((c) => {
              const cs = CATEGORY_STYLES[c];
              return (
                <span
                  key={c}
                  className={`inline-flex items-center rounded-full border font-bold ${cs.badge}`}
                  style={{ fontSize: "1.2vh", padding: "0.4vh 1.2vh", gap: "0.4vh" }}
                >
                  {cs.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Title */}
        <h2
          className="font-extrabold text-slate-50 leading-[1.3]"
          style={{
            fontSize: "3vh",
            letterSpacing: "-0.05vh",
            marginTop: "2vh",
          }}
        >
          {notice.title}
        </h2>

        {/* Body */}
        <p
          className="whitespace-pre-line text-slate-400 leading-[1.7]"
          style={{ fontSize: "1.5vh", marginTop: "1.5vh" }}
        >
          {notice.content}
        </p>

        {/* Time + check button */}
        <div
          className="flex items-center"
          style={{ marginTop: "2.5vh", gap: "1.2vh" }}
        >
          <p className="text-slate-600" style={{ fontSize: "1.2vh" }}>
            {formatRelative(notice.createdAt, now)}
          </p>
          <CheckButton notice={notice} onInteraction={onInteraction} />
        </div>

        {/* Link card */}
        {notice.link && (
          <button
            onClick={() => {
              setShowIframe(true);
              onInteraction();
            }}
            className="flex w-full items-center rounded-[0.8vh] border border-slate-700/60 bg-[#1e293b] transition-all hover:border-cyan-400/30 hover:bg-[#243044]"
            style={{
              marginTop: "2vh",
              padding: "1.5vh 1.5vh",
              gap: "1.2vh",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-center rounded-[0.5vh] bg-slate-700/50"
              style={{ width: "3vh", height: "3vh" }}
            >
              <span style={{ fontSize: "1.5vh" }}>🔗</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p
                className="truncate font-semibold text-slate-300"
                style={{ fontSize: "1.3vh" }}
              >
                관련 링크 열기
              </p>
              <p className="truncate text-slate-500" style={{ fontSize: "1vh" }}>
                {linkDomain}
              </p>
            </div>
            <span
              className="shrink-0 text-slate-600"
              style={{ fontSize: "1.3vh" }}
            >
              →
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Check Button ─── */

function CheckButton({
  notice,
  onInteraction,
}: {
  notice: Notice;
  onInteraction: () => void;
}) {
  const [localAdded, setLocalAdded] = useState(0);
  const [locked, setLocked] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbCount = getCheckCount(notice);
  const prevDbCount = useRef(dbCount);

  if (dbCount !== prevDbCount.current) {
    prevDbCount.current = dbCount;
    setLocalAdded(0);
  }

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  const count = dbCount + localAdded;

  function handleCheck() {
    if (locked) return;
    onInteraction();
    setLocalAdded((a) => a + 1);
    db.transact(
      db.tx.notices[notice.id].update({ checkCount: dbCount + localAdded + 1 }),
    );

    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const result = fireCheckEffect(r.left + r.width / 2, r.top + r.height / 2);
      if (result.cooldownMs > 0) {
        setLocked(true);
        if (lockTimer.current) clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => setLocked(false), result.cooldownMs);
      }
    }
  }

  return (
    <div className="flex items-center" style={{ gap: "0.6vh" }}>
      <button
        ref={btnRef}
        onClick={handleCheck}
        className="flex items-center rounded-full border border-slate-700/60 bg-[#1e293b] transition-all hover:border-cyan-400/30 hover:bg-[#243044] active:scale-95"
        style={{
          padding: "0.5vh 1.2vh",
          gap: "0.5vh",
          opacity: locked ? 0.5 : 1,
          pointerEvents: locked ? "none" : "auto",
        }}
      >
        <span style={{ fontSize: "1.2vh" }}>✓</span>
        <span
          className="font-semibold text-slate-300"
          style={{ fontSize: "1.1vh" }}
        >
          {count}
        </span>
      </button>
      <span style={{ fontSize: "1vh", color: "#94a3b8" }}>
        <span style={{ color: "#a78bfa" }}>👀</span> 읽어보셨다면… 체크 한번
        해보실래요?
      </span>
    </div>
  );
}

/* ─── Page Indicator ─── */

function PageIndicator({ total, current }: { total: number; current: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ padding: "1vh 0 1.5vh", gap: "0.6vh" }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
              : "bg-slate-700"
          }`}
          style={{
            height: "0.6vh",
            width: i === current ? "2vh" : "0.6vh",
          }}
        />
      ))}
    </div>
  );
}
