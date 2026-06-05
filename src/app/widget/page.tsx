"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
} from "framer-motion";
import { db, type Notice } from "@/lib/instant";
import {
  CATEGORY_STYLES,
  DEFAULT_STYLE,
  getEffectivePeriod,
  isNoticeVisible,
  parseCategories,
} from "@/lib/categories";
import { fireCheckEffect } from "@/lib/check-effects";
import {
  loadReadState,
  maybeReset,
  markRead,
  saveReadState,
  type ReadState,
} from "@/lib/widget-read-state";
import FortunePanel from "@/components/fortune/FortunePanel";
import CookiePanel from "@/components/cookie/CookiePanel";

/* ─── 상수 ──────────────────────────────────────────── */

/**
 * 위젯 버전 — CLAUDE.md 의 위젯 버저닝 룰 (V.YYYY.M.N) 을 따른다.
 * 위젯이 사용자에게 의미있게 변할 때 같은 달 안에서 N 을 증가시키고,
 * 달이 바뀌면 N 을 1 로 리셋. 사람이 직접 갱신한다.
 */
const WIDGET_VERSION = "V.2026.6.6";

const CLOCK_INTERVAL_MS = 30_000;
const PAGE_SIZE = 4;
const MAX_PAGES = 3;
const MAX_NOTICES = PAGE_SIZE * MAX_PAGES;
const PAGE_CYCLE_MS = 10_000;
const MARQUEE_SPEED_PX_PER_S = 80;
const MARQUEE_GAP_VH = 4;
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;
const ALWAYS_ON_TOP_PULSE_MS = 80;

/**
 * 하단 퀵바 바로가기. 공용 PC 라 전부 시크릿(InPrivate) 모드로 연다.
 * 항목 추가는 여기에 한 줄 늘리면 됨 (4개 초과 시 레이아웃 재검토).
 */
const QUICK_LINKS = [
  {
    icon: "📚",
    label: "LMS",
    url: "https://learn.hoseo.ac.kr/login/index.php",
  },
  {
    icon: "🏫",
    label: "포털",
    url: "https://sso.hoseo.edu/svc/tk/Auth.do?id=NEW_PORTAL&ac=Y&RelayState=%2Findex.jsp&ifa=N&",
  },
  {
    icon: "🏛️",
    label: "호서대",
    url: "https://www.hoseo.ac.kr/Home/Main.mbz",
  },
  {
    icon: "🎮",
    label: "게임갤",
    url: "https://hoseogamegal.netlify.app/",
  },
] as const;

/* ─── Electron IPC 헬퍼 ─────────────────────────────── */

type EplApi = {
  setAlwaysOnTop?: (value: boolean) => void;
  sendToBack?: () => void;
  show?: () => void;
  openExternal?: (url: string) => void;
  openExternalIncognito?: (url: string) => Promise<boolean>;
  applyUpdateAndRestart?: () => void;
};

/**
 * 외부 URL 을 시스템 기본 브라우저로 연다.
 * Electron 셸이면 epl.openExternal (main 이 shell.openExternal 호출 → 크롬 등),
 * 일반 웹이면 새 탭.
 */
function openExternal(url: string) {
  const epl = getEpl();
  if (epl?.openExternal) {
    epl.openExternal(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * 외부 URL 을 시크릿(InPrivate) 창으로 연다. 공용 PC 에서 이전 사용자의
 * 로그인 세션이 남지 않도록 main 이 Chrome --incognito (폴백: Edge
 * -inprivate) 를 직접 띄움. 셸이 구버전이라 IPC 가 없으면 일반 모드 폴백.
 *
 * 반환값: 실제로 시크릿 모드로 열렸으면 true. false 면 일반(세션 유지)
 * 창으로 폴백된 것 — 호출 측이 사용자에게 경고를 띄워야 한다.
 */
async function openExternalIncognito(url: string): Promise<boolean> {
  const epl = getEpl();
  if (epl?.openExternalIncognito) {
    try {
      // main 이 시크릿 spawn 성공 여부를 돌려준다 (폴백 시 false).
      return (await epl.openExternalIncognito(url)) === true;
    } catch {
      // main 에 핸들러가 없는 비정상 조합 — 일반 모드로라도 열어준다.
      openExternal(url);
      return false;
    }
  }
  // 구버전 preload / 웹 모드 — 시크릿 미지원.
  openExternal(url);
  return false;
}

function getEpl(): EplApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { epl?: EplApi }).epl;
}

/**
 * 위젯 창을 맨 앞으로 부각시킨다.
 * alwaysOnTop 을 false → true 로 잠깐 토글해 z-order 를 흔든다.
 */
function bringToFront() {
  const epl = getEpl();
  if (!epl) return;
  epl.show?.();
  epl.setAlwaysOnTop?.(false);
  setTimeout(() => {
    getEpl()?.setAlwaysOnTop?.(true);
  }, ALWAYS_ON_TOP_PULSE_MS);
}

/**
 * 위젯 창을 맨 뒤로 보낸다. main 에서 Windows SetWindowPos(HWND_BOTTOM) 를 호출해
 * 모든 일반 창 뒤로 z-order 를 내림. 다음 정각 리셋 사이클에서 useReadState 가
 * bringToFront 로 복귀시킴.
 */
function sendToBack() {
  const epl = getEpl();
  if (epl?.sendToBack) {
    epl.sendToBack();
  } else {
    // 구버전 셸 폴백: alwaysOnTop 만 해제
    epl?.setAlwaysOnTop?.(false);
  }
}

/* ─── 읽음 상태 훅 ────────────────────────────────── */

function useReadState(visibleIds: string[], now: number) {
  const [state, setState] = useState<ReadState>(() => loadReadState());
  const lastResetAt = useRef(state.resetAt);

  // now 가 갱신될 때마다 1시간 사이클 체크. 리셋되면 새 state 저장.
  useEffect(() => {
    setState((prev) => {
      const next = maybeReset(prev, now);
      if (next !== prev) saveReadState(next);
      return next;
    });
  }, [now]);

  // resetAt 이 바뀌었다는 건 사이클이 돌았다는 뜻 → 창을 맨 앞으로 부각 +
  // 다운로드된 업데이트가 있으면 이 시점에 적용 (없으면 main 쪽이 no-op).
  useEffect(() => {
    if (state.resetAt !== lastResetAt.current) {
      lastResetAt.current = state.resetAt;
      bringToFront();
      getEpl()?.applyUpdateAndRestart?.();
    }
  }, [state.resetAt]);

  const markReadFn = useCallback((id: string) => {
    setState((prev) => {
      const next = markRead(prev, id);
      if (next !== prev) saveReadState(next);
      return next;
    });
  }, []);

  const unreadCount = useMemo(
    () => visibleIds.filter((id) => !state.readIds.has(id)).length,
    [visibleIds, state.readIds],
  );

  return { readIds: state.readIds, unreadCount, markRead: markReadFn };
}

/* ─── 메인 페이지 ─────────────────────────────────── */

export default function WidgetPage() {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // 부팅 직후 1회 맨 앞 부각
  useEffect(() => {
    bringToFront();
  }, []);

  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  // 가시 공지 — 만료 필터 + 최대 12개 cap
  const notices = useMemo(() => {
    const raw = data?.notices ?? [];
    return raw.filter((n) => isNoticeVisible(n, now)).slice(0, MAX_NOTICES);
  }, [data, now]);

  const visibleIds = useMemo(() => notices.map((n) => n.id), [notices]);

  const { readIds, unreadCount, markRead: markReadFn } = useReadState(
    visibleIds,
    now,
  );

  if (isLoading) {
    return (
      <WidgetFrame>
        <WidgetHeader unreadCount={0} />
        <EmptySlots />
        <QuickBar />
      </WidgetFrame>
    );
  }

  if (error) {
    return (
      <WidgetFrame>
        <WidgetHeader unreadCount={0} />
        <ErrorBox message={error.message} />
        <QuickBar />
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame>
      <WidgetHeader unreadCount={unreadCount} />
      <NoticeGrid
        notices={notices}
        readIds={readIds}
        now={now}
        onSelect={setSelectedNotice}
        paused={selectedNotice !== null}
      />
      <QuickBar />
      <AnimatePresence>
        {selectedNotice && (
          <NoticeDetailOverlay
            notice={selectedNotice}
            now={now}
            onClose={() => setSelectedNotice(null)}
            onConfirm={markReadFn}
          />
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}

/* ─── Frame ─────────────────────────────────────────── */

function WidgetFrame({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "#0f1219", padding: "1.5vh" }}
    >
      {children}
    </main>
  );
}

/* ─── Header ────────────────────────────────────────── */

function WidgetHeader({
  unreadCount,
}: {
  unreadCount: number;
}) {
  return (
    <header
      className="flex shrink-0 flex-col"
      style={{ gap: "0.8vh", paddingBottom: "2vh" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-slate-400" style={{ fontSize: "1.4vh" }}>
          {WIDGET_VERSION}
        </span>
        <HeaderControl />
      </div>
      <div className="flex items-center justify-between">
        <span
          className="flex items-center whitespace-nowrap"
          style={{ gap: "1.2vh", fontSize: "4vh" }}
        >
          <span
            aria-hidden
            className="rounded-full bg-cyan-400"
            style={{
              width: "1.4vh",
              height: "1.4vh",
              boxShadow: "0 0 1vh rgba(34,211,238,0.6)",
              animation: "livePulse 2s ease-in-out infinite",
            }}
          />
          <span style={{ letterSpacing: "-0.02vh" }}>
            <span
              className="font-extrabold"
style={{
                fontSize: "1.15em",
                background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 1vh rgba(96,165,250,0.4))",
              }}
            >
              게임소프트웨어학과
            </span>
            <span
              className="font-light text-slate-400"
              style={{ marginLeft: "0.8vh", fontSize: "0.95em" }}
            >
              공지사항
            </span>
          </span>
          <UnreadBadge count={unreadCount} />
        </span>
      </div>
    </header>
  );
}

function HeaderControl() {
  return (
    <button
      type="button"
      onClick={sendToBack}
      className="leading-none text-slate-400 transition-colors hover:text-white"
      style={{ fontSize: "2.8vh", padding: "0.4vh 0.8vh" }}
      aria-label="맨 뒤로 보내기"
      title="맨 뒤로 보내기 (다음 정각 리셋 때 다시 맨 앞으로)"
    >
      ✕
    </button>
  );
}

function UnreadBadge({ count }: { count: number }) {
  const display = count > 99 ? "99+" : String(count);
  const isZero = count <= 0;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white"
      style={{
        minWidth: "5.2vh",
        height: "5.2vh",
        padding: "0 1.5vh",
        marginLeft: "1vh",
        background: isZero ? "#64748b" : "#ef4444",
        fontSize: "2.8vh",
        lineHeight: 1,
        opacity: isZero ? 0.7 : 1,
      }}
      title={isZero ? "모두 확인함" : `${count}개 안 본 공지`}
    >
      {display}
    </span>
  );
}

/* ─── Notice Grid ───────────────────────────────────── */

function NoticeGrid({
  notices,
  readIds,
  now,
  onSelect,
  paused,
}: {
  notices: Notice[];
  readIds: Set<string>;
  now: number;
  onSelect: (n: Notice) => void;
  paused: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const [pageIdx, setPageIdx] = useState(0);
  // 1 = 다음(오른쪽→왼쪽), -1 = 이전(왼쪽→오른쪽). AnimatePresence 의 enter/exit 방향을 가리키는 데 쓴다.
  const directionRef = useRef(1);

  useEffect(() => {
    setPageIdx((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  // 상세보기 열린 동안에는 자동 회전 정지. layoutId 카드가 페이지 전환으로
  // 언마운트되면 공유 레이아웃 애니메이션이 깨져 오버레이가 반투명 글리치 상태로 빠짐.
  useEffect(() => {
    if (totalPages <= 1 || paused) return;
    const id = setInterval(() => {
      directionRef.current = 1;
      setPageIdx((p) => (p + 1) % totalPages);
    }, PAGE_CYCLE_MS);
    return () => clearInterval(id);
  }, [totalPages, paused]);

  const goPrev = useCallback(() => {
    if (totalPages <= 1) return;
    directionRef.current = -1;
    setPageIdx((p) => (p - 1 + totalPages) % totalPages);
  }, [totalPages]);

  const goNext = useCallback(() => {
    if (totalPages <= 1) return;
    directionRef.current = 1;
    setPageIdx((p) => (p + 1) % totalPages);
  }, [totalPages]);

  const start = pageIdx * PAGE_SIZE;
  const pageNotices = notices.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <AnimatePresence
          initial={false}
          mode="popLayout"
          custom={directionRef.current}
        >
          <motion.div
            key={pageIdx}
            custom={directionRef.current}
            variants={{
              enter: (dir: number) => ({ x: `${dir * 100}%`, opacity: 0.4 }),
              center: { x: "0%", opacity: 1 },
              exit: (dir: number) => ({ x: `${dir * -100}%`, opacity: 0.4 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-0 grid"
            style={{ gridTemplateRows: "repeat(4, 1fr)", gap: "1.2vh" }}
          >
            {Array.from({ length: PAGE_SIZE }).map((_, i) => {
              const notice = pageNotices[i];
              if (!notice) {
                return (
                  <div
                    key={`empty-${pageIdx}-${i}`}
                    className="rounded-[1.8vh]"
                    style={{
                      background: "rgba(30,34,51,0.3)",
                      border: "1px solid rgba(148,163,184,0.06)",
                    }}
                  />
                );
              }
              return (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  isUnread={!readIds.has(notice.id)}
                  isExpiringSoon={isNoticeExpiringSoon(notice, now)}
                  onSelect={onSelect}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      <PageNav
        total={totalPages}
        current={pageIdx}
        onPrev={goPrev}
        onNext={goNext}
      />
    </div>
  );
}

function isNoticeExpiringSoon(notice: Notice, now: number): boolean {
  const { end } = getEffectivePeriod(notice);
  const diff = end - now;
  return diff > 0 && diff <= EXPIRING_SOON_MS;
}

function PageNav({
  total,
  current,
  onPrev,
  onNext,
}: {
  total: number;
  current: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const disabled = total <= 1;
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ paddingTop: "1.6vh", gap: "2.8vh" }}
    >
      <NavArrow direction="prev" onClick={onPrev} disabled={disabled} />
      <div className="flex items-center" style={{ gap: "1.2vh" }}>
        {Array.from({ length: Math.max(1, total) }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all"
            style={{
              width: i === current ? "2.8vh" : "1.6vh",
              height: "1.6vh",
              background: i === current ? "#22d3ee" : "#334155",
              boxShadow:
                i === current ? "0 0 0.8vh rgba(34,211,238,0.5)" : undefined,
            }}
          />
        ))}
      </div>
      <NavArrow direction="next" onClick={onNext} disabled={disabled} />
    </div>
  );
}

function NavArrow({
  direction,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled: boolean;
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? "이전 페이지" : "다음 페이지"}
      className="flex items-center justify-center rounded-full leading-none text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-90 disabled:cursor-not-allowed disabled:hover:bg-[rgba(255,255,255,0.06)] disabled:hover:text-slate-300"
      style={{
        width: "4.8vh",
        height: "4.8vh",
        fontSize: "3.2vh",
        background: "rgba(255,255,255,0.06)",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {isPrev ? "‹" : "›"}
    </button>
  );
}

/* ─── Quick Bar ─────────────────────────────────────── */

/** 시크릿 폴백 경고 토스트 표시 시간 */
const QUICKBAR_WARN_MS = 6000;

/**
 * 하단 고정 바로가기 퀵바. 1행 4버튼 컴팩트 (아이콘 + 짧은 라벨).
 * NoticeCard 와 같은 그라데이션 보더 톤. 클릭 시 시크릿 모드로 열림.
 * 시크릿으로 못 열고 일반 창으로 폴백되면 경고 토스트를 띄운다
 * (공용 PC 라 세션이 남는 걸 사용자가 모르고 로그인하는 사고 방지).
 */
function QuickBar() {
  const [warn, setWarn] = useState(false);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
    },
    [],
  );

  const handleClick = useCallback(async (url: string) => {
    const incognito = await openExternalIncognito(url);
    if (incognito) return;
    setWarn(true);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarn(false), QUICKBAR_WARN_MS);
  }, []);

  return (
    <div
      className="relative flex shrink-0"
      style={{ gap: "1.2vh", paddingTop: "1.4vh" }}
    >
      <AnimatePresence>
        {warn && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute inset-x-0 z-10 flex justify-center"
            style={{ bottom: "100%", paddingBottom: "0.8vh" }}
            role="status"
          >
            <span
              className="whitespace-nowrap font-bold text-amber-300"
              style={{
                background: "#1a2233",
                border: "1px solid rgba(251,191,36,0.45)",
                borderRadius: "1.2vh",
                padding: "0.8vh 1.6vh",
                fontSize: "1.8vh",
              }}
            >
              ⚠️ 시크릿 모드로 못 열어 일반 창으로 열렸어요 — 사용 후 꼭
              로그아웃하세요
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {QUICK_LINKS.map((link) => (
        <button
          key={link.url}
          type="button"
          onClick={() => void handleClick(link.url)}
          className="flex flex-1 items-center justify-center whitespace-nowrap font-extrabold text-white transition-all hover:brightness-125 active:scale-[0.97]"
          style={{
            background:
              "linear-gradient(#1a2233, #1a2233) padding-box, linear-gradient(135deg, rgba(34,211,238,0.5), rgba(96,165,250,0.35), rgba(167,139,250,0.5)) border-box",
            border: "1px solid transparent",
            borderRadius: "1.8vh",
            padding: "1.4vh 0",
            gap: "1vh",
            fontSize: "2.4vh",
          }}
          title={`${link.label} — 시크릿 모드로 열기`}
        >
          <span aria-hidden>{link.icon}</span>
          {link.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Marquee Title ─────────────────────────────────── */

function MarqueeTitle({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<{ over: boolean; distance: number }>({
    over: false,
    distance: 0,
  });

  useLayoutEffect(() => {
    function measure() {
      const c = containerRef.current;
      const t = textRef.current;
      if (!c || !t) return;
      const containerWidth = c.clientWidth;
      const textWidth = t.scrollWidth;
      const over = textWidth > containerWidth;
      const gapPx = (MARQUEE_GAP_VH / 100) * window.innerHeight;
      const distance = over ? textWidth + gapPx : 0;
      setState((prev) =>
        prev.over === over && Math.abs(prev.distance - distance) < 0.5
          ? prev
          : { over, distance },
      );
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text]);

  // framer-motion의 keyframes animate 대신 useAnimationFrame으로 직접 모션값을
  // 매 프레임 갱신한다. 부모 motion.button의 layoutId layout 트래킹이 자식의
  // transform animate를 reset하는 충돌을 피하기 위함.
  const x = useMotionValue(0);
  const startRef = useRef<number | null>(null);
  useAnimationFrame((t) => {
    if (!state.over || state.distance <= 0) return;
    if (startRef.current == null) startRef.current = t;
    const elapsedS = (t - startRef.current) / 1000;
      const cycleS = state.distance / MARQUEE_SPEED_PX_PER_S;
    const phase = (elapsedS % cycleS) / cycleS;
    x.set(-phase * state.distance);
  });

  if (!state.over) {
    return (
      <div ref={containerRef} className="min-w-0 flex-1">
        <span
          ref={textRef}
          className="block truncate font-extrabold text-white leading-[1.15]"
          style={{ fontSize: "4vh", letterSpacing: "-0.05vh" }}
        >
          {text}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
      <motion.div
        className="flex shrink-0"
        style={{ gap: `${MARQUEE_GAP_VH}vh`, width: "max-content", x }}
      >
        <span
          ref={textRef}
          className="block whitespace-nowrap font-extrabold text-white leading-[1.15]"
          style={{ fontSize: "4vh", letterSpacing: "-0.05vh" }}
        >
          {text}
        </span>
        <span
          aria-hidden
          className="block whitespace-nowrap font-extrabold text-white leading-[1.15]"
          style={{ fontSize: "4vh", letterSpacing: "-0.05vh" }}
        >
          {text}
        </span>
      </motion.div>
    </div>
  );
}

/* ─── Notice Card ───────────────────────────────────── */

function NoticeCard({
  notice,
  isUnread,
  isExpiringSoon,
  onSelect,
}: {
  notice: Notice;
  isUnread: boolean;
  isExpiringSoon: boolean;
  onSelect: (n: Notice) => void;
}) {
  return (
    <motion.button
      type="button"
      layoutId={`notice-card-${notice.id}`}
      onClick={() => onSelect(notice)}
      className="relative flex w-full items-center overflow-hidden text-left transition-transform active:scale-[0.99]"
      style={{
        background:
          "linear-gradient(#1a2233, #1a2233) padding-box, linear-gradient(135deg, rgba(34,211,238,0.35), rgba(96,165,250,0.25), rgba(167,139,250,0.35)) border-box",
        border: "1px solid transparent",
        padding: "0 2.5vh",
        borderRadius: "1.8vh",
        boxShadow: isExpiringSoon ? "inset 0 0 0 0.3vh #facc15" : undefined,
      }}
      whileTap={{ scale: 0.98 }}
    >
      <MarqueeTitle text={notice.title} />
      {isUnread && <UnreadDot />}
    </motion.button>
  );
}

function UnreadDot() {
  return (
    <span
      aria-hidden
      className="absolute rounded-full"
      style={{
        top: "0.8vh",
        right: "0.8vh",
        width: "2.4vh",
        height: "2.4vh",
        background: "#ef4444",
      }}
    />
  );
}

/* ─── Detail Overlay ────────────────────────────────── */

function getCheckCount(notice: Notice): number {
  return (notice as Notice & { checkCount?: number }).checkCount ?? 0;
}

function LinkCard({ url }: { url: string }) {
  const domain = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [url]);

  return (
    <button
      type="button"
      onClick={() => openExternal(url)}
      className="flex w-full items-center rounded-[1vh] border border-slate-700/60 bg-[#1e293b] transition-all hover:border-cyan-400/30 hover:bg-[#243044]"
      style={{
        marginBottom: "1.4vh",
        padding: "1.4vh 1.4vh",
        gap: "1.2vh",
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center rounded-[0.6vh] bg-slate-700/50"
        style={{ width: "3vh", height: "3vh" }}
      >
        <span style={{ fontSize: "3.2vh" }}>🔖</span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p
          className="truncate font-semibold text-slate-200"
          style={{ fontSize: "2.8vh", lineHeight: 1.2 }}
        >
          관련 링크 열기
        </p>
        <p
          className="truncate text-slate-400"
          style={{ fontSize: "2.2vh", lineHeight: 1.2 }}
        >
          {domain}
        </p>
      </div>
      <span
        aria-hidden
        className="shrink-0 text-slate-500"
        style={{ fontSize: "2.8vh" }}
      >
        →
      </span>
    </button>
  );
}

function NoticeDetailOverlay({
  notice,
  now,
  onClose,
  onConfirm,
}: {
  notice: Notice;
  now: number;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  const [fortuneView, setFortuneView] = useState(false);
  const [cookieView, setCookieView] = useState(false);
  const [locked, setLocked] = useState(false);
  const [localAdded, setLocalAdded] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const dbCount = getCheckCount(notice);
  const count = dbCount + localAdded;

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function handleCheck() {
    if (locked) return;
    setLocked(true);
    setLocalAdded((a) => a + 1);

    db.transact(
      db.tx.notices[notice.id].update({ checkCount: dbCount + 1 }),
    );
    onConfirm(notice.id);

    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      fireCheckEffect(r.left + r.width / 2, r.top + r.height / 2);
    }

    closeTimer.current = setTimeout(() => onClose(), 350);
  }

  const created = new Date(notice.createdAt);
  const dateLabel = `${created.getFullYear()}/${String(
    created.getMonth() + 1,
  ).padStart(2, "0")}/${String(created.getDate()).padStart(2, "0")}`;

  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)" }}
      />
      <motion.div
        layoutId={`notice-card-${notice.id}`}
        transition={{
          layout: { duration: 0.28, ease: [0.22, 0.61, 0.36, 1] },
        }}
        className="relative flex w-full flex-col overflow-hidden"
        style={{
          height: "100%",
          background:
            "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(34,211,238,0.45), rgba(96,165,250,0.3), rgba(167,139,250,0.45)) border-box",
          border: "1.5px solid transparent",
          borderRadius: "1.8vh",
          padding: "2.5vh 2.5vh 2vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X */}
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
          }}
        >
          <svg
            width="40%"
            height="40%"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        {fortuneView ? (
          <div
            className="absolute inset-0 z-40"
            style={{ padding: "1vh 2.5vh 2vh" }}
          >
            <FortunePanel onCloseFortune={() => setFortuneView(false)} />
          </div>
        ) : cookieView ? (
          <div
            className="absolute inset-0 z-40"
            style={{ padding: "1vh 2.5vh 2vh" }}
          >
            <CookiePanel onCloseCookie={() => setCookieView(false)} variant="widget" />
          </div>
        ) : (
          <>
            {/* Ambient glow */}
            <div
              className="pointer-events-none absolute -left-[30%] -top-[30%] h-[160%] w-[160%] opacity-40"
              style={{
                background:
                  (style as { glowGradient?: string }).glowGradient,
              }}
            />

            {cats.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: "0.5vh" }}>
                {cats.map((c) => (
                  <span
                    key={c}
                    className={`inline-flex items-center rounded-full border font-bold ${CATEGORY_STYLES[c].badge}`}
                    style={{ fontSize: "1.2vh", padding: "0.4vh 1.2vh" }}
                  >
                    {CATEGORY_STYLES[c].label}
                  </span>
                ))}
              </div>
            )}

            <h2
              className="font-extrabold text-white"
              style={{
                fontSize: "6vh",
                lineHeight: 1.2,
                letterSpacing: "-0.05vh",
                marginBottom: "0.6vh",
              }}
            >
              {notice.title}
            </h2>
            <p
              className="text-slate-400"
              style={{ fontSize: "2.6vh", marginBottom: "1.6vh" }}
            >
              {dateLabel}
            </p>

            <div
              className="flex-1 overflow-y-auto"
              style={{
                marginBottom: "1.6vh",
                scrollbarWidth: "thin",
                scrollbarColor: "#777 #444",
              }}
            >
              <SummaryBox notice={notice} />
              <div
                className="whitespace-pre-wrap text-white"
                style={{ fontSize: "3.4vh", lineHeight: 1.55 }}
              >
                {notice.content || "(내용 없음)"}
              </div>
            </div>

            {notice.link && <LinkCard url={notice.link} />}

            {/* Fortune & Cookie buttons */}
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1vh", marginTop: "1.5vh" }}>
              <button
                onClick={() => setFortuneView(true)}
                className="flex w-full items-center justify-center rounded-[1.2vh] border font-bold transition-all active:scale-[0.97]"
                style={{
                  padding: "1.6vh 2vh",
                  gap: "1vh",
                  background:
                    "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(139,92,246,0.08))",
                  borderColor: "rgba(167,139,250,0.25)",
                  fontSize: "2.4vh",
                }}
              >
                <span>🔮</span>
                <span className="text-slate-200">오늘의 운세</span>
              </button>
              <button
                onClick={() => setCookieView(true)}
                className="flex w-full items-center justify-center rounded-[1.2vh] border font-bold transition-all active:scale-[0.97]"
                style={{
                  padding: "1.6vh 2vh",
                  gap: "1vh",
                  background:
                    "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))",
                  borderColor: "rgba(251,191,36,0.25)",
                  fontSize: "2.4vh",
                }}
              >
                <span>🥠</span>
                <span className="text-slate-200">포춘쿠키</span>
              </button>
            </div>

            {/* Check button */}
            <button
              ref={btnRef}
              type="button"
              onClick={handleCheck}
              disabled={locked}
              className="flex w-full items-center justify-center rounded-[1.2vh] border transition-all active:scale-[0.97]"
              style={{
                marginTop: "1.2vh",
                padding: "2.2vh 2vh",
                gap: "1.2vh",
                background: locked
                  ? "rgba(30,41,59,0.5)"
                  : "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(34,211,238,0.12))",
                borderColor: locked
                  ? "rgba(100,116,139,0.2)"
                  : "rgba(167,139,250,0.3)",
                opacity: locked ? 0.6 : 1,
                pointerEvents: locked ? "none" : "auto",
              }}
            >
              <span
                className="flex items-center justify-center rounded-full font-bold text-white"
                style={{
                  width: "4vh",
                  height: "4vh",
                  background:
                    "linear-gradient(135deg, #22d3ee, #60a5fa, #a78bfa)",
                  fontSize: "2.2vh",
                  boxShadow: "0 0 1.5vh rgba(96,165,250,0.35)",
                }}
              >
                ✓
              </span>
              <span
                className="font-bold text-white"
                style={{ fontSize: "4vh", lineHeight: 1 }}
              >
                확인했어요{" "}
                <span className="text-purple-300" style={{ fontSize: "3.4vh" }}>
                  {count > 0 ? count : ""}
                </span>
              </span>
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─── Summary Box ───────────────────────────────────── */

function SummaryBox({ notice }: { notice: Notice }) {
  const summary = (notice as Notice & { summary?: string | null }).summary;
  if (!summary || summary.trim().length === 0) return null;

  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;

  return (
    <div style={{ marginBottom: "1.6vh" }}>
      <div
        className="font-semibold"
        style={{
          color: style.color,
          fontSize: "2.4vh",
          marginBottom: "0.8vh",
          letterSpacing: "0.05vh",
          display: "flex",
          alignItems: "center",
          gap: "0.8vh",
        }}
      >
        <svg
          width="2.6vh"
          height="2.6vh"
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
          borderLeft: `0.5vh solid ${style.color}`,
          borderRadius: "1vh",
          padding: "1.6vh 2vh",
          fontSize: "2.8vh",
          lineHeight: 1.5,
        }}
      >
        {summary}
      </div>
    </div>
  );
}

/* ─── Empty / Error ────────────────────────────────── */

function EmptySlots() {
  return (
    <div
      className="grid flex-1 min-h-0"
      style={{ gridTemplateRows: "repeat(4, 1fr)", gap: "1.2vh" }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1.8vh]"
          style={{
            background: "rgba(30,34,51,0.3)",
            border: "1px solid rgba(148,163,184,0.06)",
          }}
        />
      ))}
    </div>
  );
}

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
