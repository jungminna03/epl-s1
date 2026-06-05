"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { db, type Notice } from "@/lib/instant";
import {
  CATEGORY_STYLES,
  DEFAULT_STYLE,
  formatPeriodLabel,
  formatRelative,
  isNoticeVisible,
  isRelativeFresh,
  parseCategories,
  type CategoryStyle,
} from "@/lib/categories";
import { fireCheckEffect } from "@/lib/check-effects";
import { useDragScroll } from "@/lib/use-drag-scroll";
import FortunePanel from "@/components/fortune/FortunePanel";
import CookiePanel from "@/components/cookie/CookiePanel";

const CYCLE_MS = 10_000;
const PAGE_SIZE = 4;

const SPRING = { type: "spring" as const, stiffness: 200, damping: 25 };
const TWEEN_EXPAND = { type: "tween" as const, duration: 0.45, ease: "linear" as const };

function getCheckCount(notice: Notice): number {
  return (notice as Notice & { checkCount?: number }).checkCount ?? 0;
}

function openExternal(url: string) {
  // Electron 앱에서는 시스템 기본 브라우저(크롬)로 띄움; 웹에선 새 탭.
  const epl = (window as Window & { epl?: { openExternal: (u: string) => void } })
    .epl;
  if (epl?.openExternal) epl.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

type EplApi = {
  setAlwaysOnTop?: (value: boolean) => void;
};

function getEpl(): EplApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { epl?: EplApi }).epl;
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 1280); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
  const slideDirection = useRef(1); // 1 = forward (up), -1 = backward (down)

  // --- Drag-based swipe to change page (vertical) ---
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      if (expandedId) return;
      const { offset, velocity } = info;
      const swipe = Math.abs(offset.y) * 0.5 + Math.abs(velocity.y) * 0.3;
      if (swipe > 40) {
        if (offset.y < 0 && pageIdx < totalPages - 1) {
          slideDirection.current = 1;
          setPageIdx((p) => p + 1);
        } else if (offset.y > 0 && pageIdx > 0) {
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

  if (isMobile) {
    return (
      <MobileDisplay
        notices={notices}
        now={now}
      />
    );
  }

  return (
    <div
      className="overflow-hidden bg-[#0f1219]"
      style={{ width: "100vw", height: "100vh" }}
    >
      {/* Fill window — 위젯/사이니지 양쪽에서 빈 여백 없이 꽉 채움 */}
      <div
        className="relative flex flex-col"
        style={{ width: "100%", height: "100%" }}
      >
        <PinToggle />
        <TopBar now={now} isMobile={isMobile} />

        {/* Content area: 왼쪽 페이지 레일 + grid + overlay */}
        <div
          className="flex flex-1 min-h-0"
          style={{ padding: "1.5vh", gap: "1.2vh" }}
        >
          {totalPages > 1 && (
            <PageIndicator total={totalPages} current={pageIdx} />
          )}
          <div className="relative flex-1 min-h-0 overflow-hidden">
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
                enter: (dir: number) => ({ y: `${dir * 105}%`, opacity: 0.5 }),
                center: { y: 0, opacity: 1 },
                exit: (dir: number) => ({ y: `${dir * -105}%`, opacity: 0.5 }),
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              drag={expandedId ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
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
              />
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pin (always-on-top) Toggle ─── */

function PinToggle() {
  // Electron 환경에서만 노출 — 웹에선 toggle 의미 없음.
  const [available, setAvailable] = useState(false);
  const [pinned, setPinned] = useState(true); // 위젯 시작 시 always-on-top.

  useEffect(() => {
    setAvailable(!!getEpl()?.setAlwaysOnTop);
  }, []);

  if (!available) return null;

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    getEpl()?.setAlwaysOnTop?.(next);
  };

  return (
    <button
      onClick={togglePinned}
      title={pinned ? "맨 뒤 레이어로 보내기" : "맨 앞 레이어로 가져오기"}
      className="absolute flex items-center justify-center rounded-full transition-opacity hover:opacity-100"
      style={{
        top: "1.2vh",
        right: "1.2vh",
        width: "3.6vh",
        height: "3.6vh",
        zIndex: 40,
        background: "rgba(248,250,252,0.06)",
        border: "1px solid rgba(248,250,252,0.12)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        opacity: pinned ? 0.55 : 0.9,
      }}
    >
      <svg
        width="50%"
        height="50%"
        viewBox="0 0 24 24"
        fill="none"
        stroke={pinned ? "rgba(226,232,240,0.85)" : "rgba(34,211,238,0.95)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {pinned ? (
          // 맨 앞 상태: 아래로 보내기 화살표 (스택 + ↓)
          <>
            <rect x="4" y="4" width="12" height="12" rx="1" />
            <path d="M20 10 v9 M20 19 l-3 -3 M20 19 l3 -3" />
          </>
        ) : (
          // 맨 뒤 상태: 위로 가져오기 화살표 (스택 + ↑)
          <>
            <rect x="8" y="8" width="12" height="12" rx="1" />
            <path d="M4 14 v-9 M4 5 l-3 3 M4 5 l3 3" />
          </>
        )}
      </svg>
    </button>
  );
}

/* ─── Top Bar ─── */

function TopBar({ now, isMobile }: { now: number; isMobile?: boolean }) {
  const d = new Date(now);
  const date = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <header
      className="flex shrink-0 items-center justify-between border-b"
      style={{ borderColor: "rgba(34,211,238,0.06)", padding: isMobile ? "12px 16px" : "1.5vh 3vh" }}
    >
      <div className="flex items-center" style={{ gap: isMobile ? "8px" : "1vh" }}>
        <div
          className="rounded-full bg-cyan-400"
          style={{
            width: isMobile ? "8px" : "0.7vh",
            height: isMobile ? "8px" : "0.7vh",
            boxShadow: "0 0 0.6vh rgba(34,211,238,0.6)",
            animation: "livePulse 2s ease-in-out infinite",
          }}
        />
        <span style={{ fontSize: isMobile ? "16px" : "2.2vh", letterSpacing: "0.02vh" }}>
          <span
            className="font-extrabold"
            style={{
              background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: isMobile ? "none" : "drop-shadow(0 0 0.8vh rgba(96,165,250,0.4))",
            }}
          >
            게임소프트웨어학과
          </span>
          {!isMobile && (
            <span
              className="font-light text-slate-400"
              style={{ marginLeft: "0.5vh", fontSize: "0.85em" }}
            >
              공지사항
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center" style={{ gap: isMobile ? "12px" : "1vh" }}>
        <div
          className="text-right text-slate-600"
          style={{ fontSize: isMobile ? "11px" : "1.3vh", lineHeight: 1.4 }}
        >
          <div>{date}</div>
          <div>{weekday}요일</div>
        </div>
        <span
          className="font-extrabold text-slate-50 leading-none tracking-tighter"
          style={{ fontSize: isMobile ? "24px" : "3.8vh", fontVariantNumeric: "tabular-nums" }}
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
  const summary = (notice as Notice & { summary?: string | null }).summary;
  const snippet = summary && summary.trim().length > 0 ? summary : notice.content;

  return (
    <motion.div
      layoutId={`tile-${notice.id}`}
      onClick={onClick}
      className="relative flex items-center cursor-pointer overflow-hidden rounded-[1.5vh]"
      style={{
        background: "linear-gradient(#1a2233, #1a2233) padding-box, linear-gradient(135deg, rgba(34,211,238,0.35), rgba(96,165,250,0.25), rgba(167,139,250,0.35)) border-box",
        border: "1px solid transparent",
        padding: "1.5vh 2.5vh 1.5vh 3vh",
        gap: "2vh",
        opacity: dimmed ? 0.3 : 1,
        transition: "opacity 0.2s",
      }}
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
          className="font-extrabold text-slate-50 leading-[1.2] truncate"
          style={{
            fontSize: "3.2vh",
            letterSpacing: "-0.05vh",
          }}
        >
          {notice.title}
        </h3>
        {snippet && (
          <p
            className="text-slate-300 leading-[1.4] line-clamp-3"
            style={{
              fontSize: "1.5vh",
              marginTop: "0.6vh",
              whiteSpace: "pre-line",
            }}
          >
            {snippet}
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
            className="flex items-center font-semibold"
            style={{
              gap: "0.3vh",
              fontSize: "1.1vh",
              background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
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
}: {
  notice: Notice;
  now: number;
  onClose: () => void;
}) {
  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const expandedPeriodLabel = formatPeriodLabel(notice);
  // 기간 라벨이 있으면 날짜 폴백(작성 후 7일 경과)은 중복이라 숨긴다
  const showCreatedLabel =
    !expandedPeriodLabel || isRelativeFresh(notice.createdAt, now);
  const [panelView, setPanelView] = useState<null | "fortune" | "cookie">(null);

  // --- Overscroll-to-close (touch + mouse) ---
  const scrollRef = useRef<HTMLDivElement>(null);
  // 마우스 드래그로도 스크롤되게 (터치는 native 스크롤). 휠도 그대로 동작.
  const dragScroll = useDragScroll();
  const overscrollStart = useRef<{ x: number; y: number; atTop: boolean; atBottom: boolean } | null>(null);

  const captureStart = useCallback((x: number, y: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    overscrollStart.current = { x, y, atTop, atBottom };
  }, []);

  const captureEnd = useCallback((x: number, y: number) => {
    if (!overscrollStart.current) return;
    const start = overscrollStart.current;
    overscrollStart.current = null;

    const dx = x - start.x;
    const dy = y - start.y;
    const H_THRESHOLD = 60; // 좌우 스와이프 닫기
    const V_THRESHOLD = 110; // 끝에서 더 끌어 닫기 — 고무줄 피드백 구간을 넘겨야 발동

    // Horizontal overscroll (always counts — no horizontal scroll)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > H_THRESHOLD) {
      onClose();
      return;
    }
    // Vertical overscroll at edges
    if (start.atTop && dy > V_THRESHOLD) {
      onClose();
      return;
    }
    if (start.atBottom && dy < -V_THRESHOLD) {
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

  return (
    <motion.div
      layoutId={`tile-${notice.id}`}
      className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-[1.5vh]"
      style={{
        background: "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(34,211,238,0.45), rgba(96,165,250,0.3), rgba(167,139,250,0.45)) border-box",
        border: "1.5px solid transparent",
      }}
      transition={TWEEN_EXPAND}
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

      {/* Scrollable content — 진짜 스크롤. (이전 framer drag 방식은
          dragSnapToOrigin 이 항상 원위치로 되돌려 긴 내용을 읽을 수 없었음.)
          가장자리에서 더 당기면 닫히는 overscroll-to-close 는 유지. */}
      <div
        ref={(node) => {
          scrollRef.current = node;
          dragScroll(node);
        }}
        className="relative z-10 flex-1 select-none overflow-y-auto text-center flex flex-col"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#475569 transparent" }}
        onTouchStart={(e) => captureStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={(e) => captureEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY)}
        onMouseDown={(e) => captureStart(e.clientX, e.clientY)}
        onMouseUp={(e) => captureEnd(e.clientX, e.clientY)}
      >
      {/* shrink-0 필수: 없으면 flex item 으로서 컨테이너 높이에 맞게 찌그러져
          scrollHeight == clientHeight 가 되고 (스크롤 불능), 내용물은
          justify-center 로 위아래 양쪽으로 잘려나간다. */}
      <div
        key={notice.id}
        className="flex shrink-0 flex-col justify-center"
        style={{ padding: "3vh", minHeight: "100%" }}
      >
        {/* Category badges */}
        {cats.length > 0 && (
          <div className="flex flex-wrap justify-center" style={{ gap: "0.5vh" }}>
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

        {/* AI Summary */}
        <SummaryBox notice={notice} />

        {/* Body */}
        <p
          className="whitespace-pre-line text-slate-400 leading-[1.7]"
          style={{ fontSize: "1.5vh", marginTop: "1.5vh" }}
        >
          {notice.content}
        </p>

        {/* Time */}
        <p className="text-slate-600" style={{ fontSize: "1.2vh", marginTop: "2.5vh" }}>
          {showCreatedLabel && formatRelative(notice.createdAt, now)}
          {expandedPeriodLabel && (
            <span style={{ marginLeft: showCreatedLabel ? "1vh" : 0 }}>
              📅 {expandedPeriodLabel}
            </span>
          )}
        </p>

        {/* Link card */}
        {notice.link && (
          <button
            onClick={() => {
              if (notice.link) openExternal(notice.link);
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

        {/* Fortune & Cookie buttons */}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1vh", marginTop: "2vh" }}>
          <button
            onClick={() => setPanelView("fortune")}
            className="flex w-full items-center justify-center rounded-[0.8vh] border font-bold transition-all active:scale-[0.97]"
            style={{
              padding: "1.2vh 1vh",
              gap: "0.6vh",
              background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(139,92,246,0.08))",
              borderColor: "rgba(167,139,250,0.25)",
              fontSize: "1.4vh",
            }}
          >
            <span>🔮</span>
            <span className="text-slate-200">오늘의 운세</span>
          </button>
          <button
            onClick={() => setPanelView("cookie")}
            className="flex w-full items-center justify-center rounded-[0.8vh] border font-bold transition-all active:scale-[0.97]"
            style={{
              padding: "1.2vh 1vh",
              gap: "0.6vh",
              background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))",
              borderColor: "rgba(251,191,36,0.25)",
              fontSize: "1.4vh",
            }}
          >
            <span>🥠</span>
            <span className="text-slate-200">포춘쿠키</span>
          </button>
        </div>

        {/* Check button — big & tappable */}
        <CheckButton notice={notice} onChecked={onClose} />
      </div>
      </div>

      {/* Fortune / Cookie overlay panels */}
      {panelView === "fortune" && (
        <div className="absolute inset-0 z-40" style={{ padding: "1vh" }}>
          <FortunePanel onCloseFortune={() => setPanelView(null)} />
        </div>
      )}
      {panelView === "cookie" && (
        <div className="absolute inset-0 z-40" style={{ padding: "1vh" }}>
          <CookiePanel onCloseCookie={() => setPanelView(null)} variant="display" />
        </div>
      )}
    </motion.div>
  );
}

/* ─── Check Button ─── */

function CheckButton({
  notice,
  onChecked,
}: {
  notice: Notice;
  onChecked?: () => void;
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

    onChecked?.();
  }

  return (
    <button
      ref={btnRef}
      onClick={handleCheck}
      className="flex w-full items-center justify-center rounded-[1vh] border transition-all active:scale-[0.97]"
      style={{
        marginTop: "2vh",
        padding: "1.8vh 2vh",
        gap: "1vh",
        background: locked
          ? "rgba(30,41,59,0.5)"
          : "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(34,211,238,0.10))",
        borderColor: locked
          ? "rgba(100,116,139,0.2)"
          : "rgba(167,139,250,0.25)",
        opacity: locked ? 0.5 : 1,
        pointerEvents: locked ? "none" : "auto",
      }}
    >
      <span
        className="flex items-center justify-center rounded-full font-bold text-white"
        style={{
          width: "3.5vh",
          height: "3.5vh",
          background: "linear-gradient(135deg, #22d3ee, #60a5fa, #a78bfa)",
          fontSize: "1.8vh",
          boxShadow: "0 0 1.5vh rgba(96,165,250,0.3)",
        }}
      >
        ✓
      </span>
      <div className="flex flex-col items-start" style={{ gap: "0.2vh" }}>
        <span
          className="font-bold text-slate-200"
          style={{ fontSize: "1.6vh", lineHeight: 1 }}
        >
          확인했어요{" "}
          <span className="text-purple-400" style={{ fontSize: "1.4vh" }}>
            {count > 0 ? count : ""}
          </span>
        </span>
        <span className="text-slate-500" style={{ fontSize: "1vh", lineHeight: 1 }}>
          읽어보셨다면 체크 한번 해보실래요?
        </span>
      </div>
    </button>
  );
}

/* ─── Page Indicator ─── */

/** 인디케이터 점 하나가 차지하는 세로 슬롯 높이 (vh) */
const INDICATOR_SLOT_VH = 2.6;

function PageIndicator({ total, current }: { total: number; current: number }) {
  // 왼쪽 전용 세로 레일 — 고정된 점 트랙 위를 활성 썸(pill)이 위아래로
  // 스프링 슬라이드한다. 페이지 세로 전환과 결을 맞춘 스크롤 스택 느낌.
  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center"
      style={{ width: "3vh" }}
    >
      <div className="relative">
        {/* 점 트랙 */}
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-center"
            style={{ width: "1vh", height: `${INDICATOR_SLOT_VH}vh` }}
          >
            <div
              className="rounded-full bg-slate-700"
              style={{ width: "1vh", height: "1vh" }}
            />
          </div>
        ))}
        {/* 활성 썸 — 현재 페이지 슬롯으로 슬라이드 */}
        <motion.div
          className="absolute left-0 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]"
          style={{
            top: `${INDICATOR_SLOT_VH * 0.1}vh`,
            width: "1vh",
            height: `${INDICATOR_SLOT_VH * 0.8}vh`,
          }}
          initial={false}
          animate={{ y: `${current * INDICATOR_SLOT_VH}vh` }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        />
      </div>
    </div>
  );
}

/* ─── Mobile Display ─── */

function MobileDisplay({ notices, now }: { notices: Notice[]; now: number }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const paginated = notices.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  // Auto cycle every 10s
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setCurrentPage((p) => (p + 1) % totalPages);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  const selected = selectedId
    ? notices.find((n) => n.id === selectedId) ?? null
    : null;

  const d = new Date(now);
  const dateStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="flex h-screen flex-col bg-[#0f1219]">
      {/* Header */}
      <header className="shrink-0 border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-lg font-extrabold text-transparent">
              게임소프트웨어학과
            </span>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">{dateStr} {weekday}요일</div>
            <div className="text-xl font-extrabold text-slate-50">{timeStr}</div>
          </div>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {paginated.map((notice) => (
            <MobileNoticeCard
              key={notice.id}
              notice={notice}
              now={now}
              onClick={() => setSelectedId(notice.id)}
            />
          ))}
        </div>

        {/* Page dots */}
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`rounded-full transition-all ${
                  i === currentPage
                    ? "h-1.5 w-6 bg-cyan-400"
                    : "h-1.5 w-1.5 bg-slate-600"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <MobileDetailModal
          notice={selected}
          now={now}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function MobileNoticeCard({
  notice,
  now,
  onClick,
}: {
  notice: Notice;
  now: number;
  onClick: () => void;
}) {
  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const dbCount = getCheckCount(notice);
  const summary = (notice as Notice & { summary?: string | null }).summary;
  const snippet = summary && summary.trim().length > 0 ? summary : notice.content;
  const periodLabel = formatPeriodLabel(notice);
  const showCreated = !periodLabel || isRelativeFresh(notice.createdAt, now);

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-xl border border-white/5 bg-[#1a2233] p-4 text-left"
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: style.color }}
      />
      <div className="pl-3">
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const cs = CATEGORY_STYLES[c];
            return (
              <span
                key={c}
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cs.badge}`}
              >
                {cs.label}
              </span>
            );
          })}
        </div>
        <h3 className="mt-2 text-base font-bold text-slate-50 line-clamp-1">
          {notice.title}
        </h3>
        {snippet && (
          <p className="mt-1 whitespace-pre-line text-sm text-slate-300 line-clamp-3">
            {snippet}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {showCreated && formatRelative(notice.createdAt, now)}
            {periodLabel && (
              <span className={showCreated ? "ml-2" : undefined}>
                📅 {periodLabel}
              </span>
            )}
          </span>
          {dbCount > 0 && (
            <span className="text-xs text-emerald-400">✓ {dbCount}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function MobileDetailModal({
  notice,
  now,
  onClose,
}: {
  notice: Notice;
  now: number;
  onClose: () => void;
}) {
  const cats = parseCategories(notice.category);
  const linkDomain = notice.link
    ? (() => { try { return new URL(notice.link).hostname; } catch { return notice.link; } })()
    : null;
  const periodLabel = formatPeriodLabel(notice);
  const showCreated = !periodLabel || isRelativeFresh(notice.createdAt, now);
  const [panelView, setPanelView] = useState<null | "fortune" | "cookie">(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-[#0f1219] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-600" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300"
        >
          ✕
        </button>

        {/* Category */}
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const cs = CATEGORY_STYLES[c];
            return (
              <span
                key={c}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${cs.badge}`}
              >
                {cs.label}
              </span>
            );
          })}
        </div>

        {/* Title */}
        <h2 className="mt-4 text-xl font-extrabold text-slate-50">
          {notice.title}
        </h2>

        {/* Time */}
        <p className="mt-2 text-sm text-slate-500">
          {showCreated && formatRelative(notice.createdAt, now)}
          {periodLabel && (
            <span className={showCreated ? "ml-2" : undefined}>
              📅 {periodLabel}
            </span>
          )}
        </p>

        {/* AI Summary */}
        <div className="mt-4">
          <SummaryBox notice={notice} />
        </div>

        {/* Content */}
        <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-slate-300">
          {notice.content || "내용이 없습니다."}
        </p>

        {/* Link */}
        {notice.link && (
          <button
            onClick={() => openExternal(notice.link!)}
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-slate-700/60 bg-[#1e293b] p-3"
          >
            <span className="text-lg">🔗</span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-slate-300">관련 링크 열기</p>
              <p className="truncate text-xs text-slate-500">{linkDomain}</p>
            </div>
            <span className="text-slate-600">→</span>
          </button>
        )}

        {/* Fortune & Cookie buttons */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPanelView("fortune")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(139,92,246,0.08))",
              borderColor: "rgba(167,139,250,0.25)",
            }}
          >
            <span>🔮</span>
            <span className="text-slate-200">오늘의 운세</span>
          </button>
          <button
            onClick={() => setPanelView("cookie")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))",
              borderColor: "rgba(251,191,36,0.25)",
            }}
          >
            <span>🥠</span>
            <span className="text-slate-200">포춘쿠키</span>
          </button>
        </div>

        {/* Check button */}
        <div className="mt-6">
          <CheckButton notice={notice} onChecked={onClose} />
        </div>

        {/* Fortune / Cookie overlay panels */}
        {panelView === "fortune" && (
          <div className="absolute inset-0 z-40 rounded-t-2xl bg-[#0f1219] p-3">
            <FortunePanel onCloseFortune={() => setPanelView(null)} />
          </div>
        )}
        {panelView === "cookie" && (
          <div className="absolute inset-0 z-40 rounded-t-2xl bg-[#0f1219] p-3">
            <CookiePanel onCloseCookie={() => setPanelView(null)} variant="display" />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── AI Summary Box (expanded view 전용) ───────────── */

function SummaryBox({ notice }: { notice: Notice }) {
  const summary = (notice as Notice & { summary?: string | null }).summary;
  if (!summary || summary.trim().length === 0) return null;

  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;

  return (
    <div style={{ marginTop: "1.5vh", textAlign: "left" }}>
      <div
        className="font-semibold"
        style={{
          color: style.color,
          fontSize: "1.8vh",
          marginBottom: "0.7vh",
          letterSpacing: "0.05vh",
          display: "flex",
          alignItems: "center",
          gap: "0.6vh",
        }}
      >
        <svg
          width="2vh"
          height="2vh"
          viewBox="0 0 24 24"
          fill="none"
          stroke={style.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
          <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
        </svg>
        <span>AI 요약</span>
      </div>
      <div
        className="text-slate-100"
        style={{
          background: "rgba(255,255,255,0.05)",
          borderLeft: `0.4vh solid ${style.color}`,
          borderRadius: "0.8vh",
          padding: "1.2vh 1.5vh",
          fontSize: "1.5vh",
          lineHeight: 1.55,
        }}
      >
        {summary}
      </div>
    </div>
  );
}
