# 1:1 정사각형 2×2 그리드 레이아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 60%/40% two-panel landscape layout with a 1:1 square 2×2 grid layout featuring overlay fullscreen expansion on tile touch.

**Architecture:** The display page (`src/app/display/page.tsx`) will be rewritten. The 2-panel `SignageLayout` → `DetailPanel` + `ListPanel` structure is replaced by a single `GridLayout` component with `GridTile` items. Tile expansion uses Framer Motion `layoutId` to animate from grid position to fullscreen overlay. Two independent timers manage page cycling (grid-only) and fullscreen return (60s inactivity). All existing features (check button, link card, effects) are preserved inside the expanded tile.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Framer Motion, InstantDB

---

### Task 1: Replace SignageLayout shell with 1:1 grid container

**Files:**
- Modify: `src/app/display/page.tsx:59-131` (replace `SignageLayout`)

- [ ] **Step 1: Replace SignageLayout with grid shell**

Replace the entire `SignageLayout` function with a new grid-based layout. Keep the same props signature. The key changes:
- Container: `aspect-ratio: 1` centered in viewport, instead of `h-screen grid-cols-[60%_40%]`
- Grid: `grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr` with gap
- Pagination: 4 items per page instead of 5-item vertical list
- Two independent timer refs

```tsx
const CYCLE_MS = 10_000;
const RETURN_MS = 60_000;
const PAGE_SIZE = 4;

function SignageLayout({ notices, now }: { notices: Notice[]; now: number }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Timer refs
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRemainingRef = useRef(CYCLE_MS);
  const cyclePausedAtRef = useRef<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const pageNotices = notices.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);

  // ─── Page cycle timer (grid-only) ───
  const startCycleTimer = useCallback(() => {
    if (cycleTimer.current) clearInterval(cycleTimer.current);
    cycleRemainingRef.current = CYCLE_MS;
    cyclePausedAtRef.current = null;
    cycleTimer.current = setInterval(() => {
      setPageIdx((prev) => (prev + 1) % Math.max(1, Math.ceil(notices.length / PAGE_SIZE)));
    }, CYCLE_MS);
  }, [notices.length]);

  const pauseCycleTimer = useCallback(() => {
    if (cycleTimer.current) {
      clearInterval(cycleTimer.current);
      cycleTimer.current = null;
    }
    cyclePausedAtRef.current = Date.now();
  }, []);

  const resumeCycleTimer = useCallback(() => {
    if (cycleTimer.current) clearInterval(cycleTimer.current);
    // Resume with fresh interval
    cycleTimer.current = setInterval(() => {
      setPageIdx((prev) => (prev + 1) % Math.max(1, Math.ceil(notices.length / PAGE_SIZE)));
    }, CYCLE_MS);
    cyclePausedAtRef.current = null;
  }, [notices.length]);

  // ─── Fullscreen return timer (60s) ───
  const startReturnTimer = useCallback(() => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
    returnTimer.current = setTimeout(() => {
      setExpandedIdx(null);
      resumeCycleTimer();
    }, RETURN_MS);
  }, [resumeCycleTimer]);

  const resetReturnTimer = useCallback(() => {
    startReturnTimer();
  }, [startReturnTimer]);

  const clearReturnTimer = useCallback(() => {
    if (returnTimer.current) {
      clearTimeout(returnTimer.current);
      returnTimer.current = null;
    }
  }, []);

  // ─── Tile expand/collapse ───
  const handleTileExpand = useCallback((globalIdx: number) => {
    setExpandedIdx(globalIdx);
    pauseCycleTimer();
    startReturnTimer();
  }, [pauseCycleTimer, startReturnTimer]);

  const handleTileCollapse = useCallback(() => {
    setExpandedIdx(null);
    clearReturnTimer();
    resumeCycleTimer();
  }, [clearReturnTimer, resumeCycleTimer]);

  const handleInteraction = useCallback(() => {
    if (expandedIdx !== null) {
      resetReturnTimer();
    }
  }, [expandedIdx, resetReturnTimer]);

  // Start cycle on mount
  useEffect(() => {
    startCycleTimer();
    return () => {
      if (cycleTimer.current) clearInterval(cycleTimer.current);
      if (returnTimer.current) clearTimeout(returnTimer.current);
    };
  }, [startCycleTimer]);

  // Reset page when notices change
  useEffect(() => {
    setPageIdx(0);
    setExpandedIdx(null);
  }, [notices.length]);

  const expandedNotice = expandedIdx !== null ? notices[expandedIdx] : null;

  return (
    <div className="flex h-screen items-center justify-center bg-[#0f1219]">
      <div className="relative" style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}>
        <TopBar now={now} />

        {/* Grid area */}
        <div className="absolute" style={{ top: "auto", left: 0, right: 0, bottom: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pageIdx}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="grid"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: "0.8vh",
                padding: "0.8vh",
                height: "100%",
              }}
            >
              {pageNotices.map((notice, i) => {
                const globalIdx = pageIdx * PAGE_SIZE + i;
                return (
                  <GridTile
                    key={notice.id}
                    notice={notice}
                    now={now}
                    isExpanded={false}
                    onExpand={() => handleTileExpand(globalIdx)}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Expanded overlay */}
        <AnimatePresence>
          {expandedNotice && (
            <ExpandedTile
              notice={expandedNotice}
              now={now}
              onClose={handleTileCollapse}
              onInteraction={handleInteraction}
            />
          )}
        </AnimatePresence>

        {/* Page indicator */}
        {totalPages > 1 && (
          <PageIndicator current={pageIdx} total={totalPages} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles (no runtime yet — components not written)**

Run: `npx next build 2>&1 | head -20`
Expected: Type errors for missing `GridTile`, `ExpandedTile`, `PageIndicator` — that's fine for now.

- [ ] **Step 3: Commit scaffold**

```bash
git add src/app/display/page.tsx
git commit -m "refactor: replace 2-panel layout with grid shell"
```

---

### Task 2: Build GridTile component

**Files:**
- Modify: `src/app/display/page.tsx` (add `GridTile` function after `SignageLayout`)

- [ ] **Step 1: Write GridTile component**

This renders a single tile in the 2×2 grid. Shows category badge, title, summary (truncated), and time.

```tsx
function GridTile({
  notice,
  now,
  isExpanded,
  onExpand,
}: {
  notice: Notice;
  now: number;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const checkCount = (notice as Notice & { checkCount?: number }).checkCount ?? 0;

  return (
    <motion.div
      layoutId={`tile-${notice.id}`}
      onClick={onExpand}
      className="relative flex cursor-pointer flex-col overflow-hidden rounded-[1.2vh] border"
      style={{
        background: "#1a2233",
        borderColor: `${style.color}15`,
        padding: "1.8vh",
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      {/* Left color bar */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: "0.4vh",
          background: style.color,
          borderRadius: "1.2vh 0 0 1.2vh",
        }}
      />

      {/* Category badge */}
      {cats.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: "0.5vh", marginLeft: "0.6vh" }}>
          {cats.map((c) => {
            const cs = CATEGORY_STYLES[c];
            return (
              <span
                key={c}
                className={`inline-flex items-center rounded-full border font-bold ${cs.badge}`}
                style={{ fontSize: "1.4vh", padding: "0.3vh 1vh" }}
              >
                {cs.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Title */}
      <h3
        className="font-extrabold text-slate-50 leading-[1.3]"
        style={{
          fontSize: "2.2vh",
          marginTop: "1vh",
          marginLeft: "0.6vh",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {notice.title}
      </h3>

      {/* Summary */}
      <p
        className="text-slate-500 leading-[1.5]"
        style={{
          fontSize: "1.4vh",
          marginTop: "0.8vh",
          marginLeft: "0.6vh",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {notice.content}
      </p>

      {/* Footer */}
      <div
        className="mt-auto flex items-center"
        style={{ marginLeft: "0.6vh", paddingTop: "1vh", gap: "0.8vh" }}
      >
        <span className="text-slate-600" style={{ fontSize: "1.2vh" }}>
          {formatRelative(notice.createdAt, now)}
        </span>
        {checkCount > 0 && (
          <span style={{ fontSize: "1.2vh", color: `${style.color}80`, marginLeft: "auto" }}>
            ✓ {checkCount}
          </span>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: add GridTile component for 2x2 grid"
```

---

### Task 3: Build ExpandedTile overlay component

**Files:**
- Modify: `src/app/display/page.tsx` (add `ExpandedTile` function)

- [ ] **Step 1: Write ExpandedTile component**

This is the fullscreen overlay that appears when a tile is touched. It uses `layoutId` matching to animate from the grid tile position. Shows full detail: category, title, full body, link card, check button. Has an X close button top-right.

```tsx
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
  const prevNoticeId = useRef<string | null>(null);

  useEffect(() => {
    if (notice.id !== prevNoticeId.current) {
      setShowIframe(false);
      prevNoticeId.current = notice.id;
    }
  }, [notice.id]);

  const linkDomain = notice.link
    ? (() => { try { return new URL(notice.link).hostname; } catch { return notice.link; } })()
    : null;

  if (showIframe && notice.link) {
    return (
      <motion.div
        layoutId={`tile-${notice.id}`}
        className="absolute flex flex-col overflow-hidden rounded-[1.2vh] border"
        style={{
          top: 0, left: "0.8vh", right: "0.8vh", bottom: "3.5vh",
          marginTop: "auto",
          background: "#1a2233",
          borderColor: `${style.color}30`,
          zIndex: 20,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        <button
          onClick={() => { setShowIframe(false); onInteraction(); }}
          className="flex items-center border-b bg-[#1a2233] text-slate-400"
          style={{
            borderColor: `${style.color}15`,
            padding: "1vh 2vh",
            gap: "0.8vh",
            fontSize: "1.6vh",
          }}
        >
          <span>←</span> 공지로 돌아가기
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
      className="absolute flex flex-col overflow-hidden rounded-[1.2vh] border"
      style={{
        top: 0, left: "0.8vh", right: "0.8vh", bottom: "3.5vh",
        marginTop: "auto",
        background: "#1a2233",
        borderColor: `${style.color}30`,
        boxShadow: `0 0 4vh ${style.color}15`,
        zIndex: 20,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      {/* Left color bar */}
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: "0.4vh",
          background: style.color,
          borderRadius: "1.2vh 0 0 1.2vh",
        }}
      />

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-[30%] -top-[30%] h-[160%] w-[160%] opacity-60"
        style={{ background: style.glowGradient }}
      />

      {/* Close button */}
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
        }}
      >
        <svg width="1.8vh" height="1.8vh" viewBox="0 0 14 14" fill="none"
          style={{ width: "1.8vh", height: "1.8vh" }}>
          <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Scrollable content */}
      <div
        className="relative z-10 flex flex-1 flex-col overflow-y-auto"
        style={{ padding: "2.5vh 3vh", paddingRight: "6vh" }}
        onScroll={onInteraction}
        onTouchStart={onInteraction}
      >
        {/* Category badges */}
        {cats.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: "0.8vh" }}>
            {cats.map((c) => {
              const cs = CATEGORY_STYLES[c];
              return (
                <span
                  key={c}
                  className={`inline-flex items-center rounded-full border font-bold ${cs.badge}`}
                  style={{ fontSize: "1.6vh", padding: "0.4vh 1.2vh" }}
                >
                  {cs.label}
                </span>
              );
            })}
            <span className="text-slate-600" style={{ fontSize: "1.4vh" }}>
              {formatRelative(notice.createdAt, now)}
            </span>
          </div>
        )}

        {/* Title */}
        <h2
          className="font-extrabold text-slate-50 leading-[1.3]"
          style={{ fontSize: "3.5vh", letterSpacing: "-0.05vh", marginTop: "1.5vh" }}
        >
          {notice.title}
        </h2>

        {/* Body */}
        <p
          className="whitespace-pre-line text-slate-400 leading-[1.7]"
          style={{ fontSize: "1.8vh", marginTop: "2vh", flex: 1 }}
        >
          {notice.content}
        </p>

        {/* Link card */}
        {notice.link && (
          <button
            onClick={() => { setShowIframe(true); onInteraction(); }}
            className="mt-[2vh] flex w-full items-center rounded-[0.8vh] border bg-[#1e293b]"
            style={{
              borderColor: `${style.color}20`,
              padding: "1.5vh 2vh",
              gap: "1.2vh",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-center rounded-[0.5vh]"
              style={{ width: "3.5vh", height: "3.5vh", background: `${style.color}15` }}
            >
              <span style={{ fontSize: "1.8vh" }}>🔗</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate font-semibold text-slate-300" style={{ fontSize: "1.6vh" }}>관련 링크 열기</p>
              <p className="truncate text-slate-500" style={{ fontSize: "1.2vh" }}>{linkDomain}</p>
            </div>
            <span className="shrink-0 text-slate-600" style={{ fontSize: "1.6vh" }}>→</span>
          </button>
        )}

        {/* Check button */}
        <div style={{ marginTop: "2vh", display: "flex", justifyContent: "center" }}>
          <CheckButton notice={notice} onInteraction={onInteraction} />
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: add ExpandedTile overlay with close button"
```

---

### Task 4: Build PageIndicator and update grid positioning

**Files:**
- Modify: `src/app/display/page.tsx` (add `PageIndicator`, fix grid area positioning)

- [ ] **Step 1: Write PageIndicator component**

```tsx
function PageIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="absolute flex items-center justify-center"
      style={{ bottom: "0.8vh", left: 0, right: 0, height: "2.5vh", gap: "0.6vh", zIndex: 10 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            height: "0.5vh",
            width: i === current ? "2vh" : "0.5vh",
            background: i === current ? "#22d3ee" : "rgba(34,211,238,0.2)",
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Fix grid area positioning in SignageLayout**

The grid area needs to sit between the TopBar and the PageIndicator. Update the container structure in `SignageLayout`'s return JSX. The TopBar takes its natural height, the grid fills the middle, and the indicator sits at the bottom.

Replace the inner container layout in SignageLayout's return:

```tsx
return (
  <div className="flex h-screen items-center justify-center bg-[#0f1219]">
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}
    >
      <TopBar now={now} />

      {/* Grid + overlay container */}
      <div className="relative flex-1" style={{ padding: "0.8vh", paddingBottom: "3.5vh" }}>
        {/* Background grid borders (visible when expanded) */}
        {expandedNotice && (
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: "0.8vh",
              padding: "0.8vh",
              paddingBottom: "3.5vh",
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-[1.2vh]"
                style={{
                  border: "1px solid rgba(148,163,184,0.06)",
                  opacity: 0.3,
                }}
              />
            ))}
          </div>
        )}

        {/* Grid tiles */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pageIdx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="grid h-full"
            style={{
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: "0.8vh",
            }}
          >
            {pageNotices.map((notice, i) => {
              const globalIdx = pageIdx * PAGE_SIZE + i;
              return (
                <GridTile
                  key={notice.id}
                  notice={notice}
                  now={now}
                  isExpanded={expandedIdx === globalIdx}
                  onExpand={() => handleTileExpand(globalIdx)}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Expanded overlay */}
        <AnimatePresence>
          {expandedNotice && (
            <ExpandedTile
              notice={expandedNotice}
              now={now}
              onClose={handleTileCollapse}
              onInteraction={handleInteraction}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Page indicator */}
      {totalPages > 1 && (
        <PageIndicator current={pageIdx} total={totalPages} />
      )}
    </div>
  </div>
);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: add PageIndicator and fix grid positioning"
```

---

### Task 5: Update CheckButton for grid context

**Files:**
- Modify: `src/app/display/page.tsx` (update `CheckButton` sizing)

- [ ] **Step 1: Update CheckButton to use vh units**

The existing CheckButton uses `vw` units which was correct for the 16:9 layout. In the 1:1 container, switch to `vh` units for consistent sizing. Replace the entire `CheckButton` function:

```tsx
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
  const dbCount = (notice as Notice & { checkCount?: number }).checkCount ?? 0;
  const prevDbCount = useRef(dbCount);

  if (dbCount !== prevDbCount.current) {
    prevDbCount.current = dbCount;
    setLocalAdded(0);
  }

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
        setTimeout(() => setLocked(false), result.cooldownMs);
      }
    }
  }

  return (
    <div className="flex items-center" style={{ gap: "1vh" }}>
      <button
        ref={btnRef}
        onClick={handleCheck}
        className="flex items-center rounded-full border border-slate-700/60 bg-[#1e293b] transition-all hover:border-cyan-400/30 hover:bg-[#243044] active:scale-95"
        style={{
          padding: "0.6vh 1.5vh",
          gap: "0.6vh",
          opacity: locked ? 0.5 : 1,
          pointerEvents: locked ? "none" : "auto",
        }}
      >
        <span style={{ fontSize: "1.6vh" }}>✓</span>
        <span className="font-semibold text-slate-300" style={{ fontSize: "1.4vh" }}>
          {count}
        </span>
      </button>
      <span style={{ fontSize: "1.2vh", color: "#94a3b8" }}>
        <span style={{ color: "#a78bfa" }}>👀</span>
        {" "}읽어보셨다면… 체크 한번 해보실래요?
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: update CheckButton sizing for grid layout"
```

---

### Task 6: Update TopBar for 1:1 container

**Files:**
- Modify: `src/app/display/page.tsx` (update `TopBar` sizing)

- [ ] **Step 1: Update TopBar to use vh units and fit square container**

The TopBar should no longer span `col-span-2`. It sits at the top of the flex column. Update sizing from `vw` to `vh`.

```tsx
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
      style={{ borderColor: "rgba(34,211,238,0.06)", padding: "1.2vh 2vh" }}
    >
      <div className="flex items-center" style={{ gap: "1vh" }}>
        <div
          className="rounded-full bg-cyan-400"
          style={{
            width: "0.8vh",
            height: "0.8vh",
            boxShadow: "0 0 0.6vh rgba(34,211,238,0.6)",
            animation: "livePulse 2s ease-in-out infinite",
          }}
        />
        <span style={{ fontSize: "1.6vh", letterSpacing: "0.02vh" }}>
          <span
            className="font-extrabold"
            style={{
              background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 0.8vh rgba(96,165,250,0.4))",
            }}
          >게임소프트웨어학과</span>
          <span className="font-light text-slate-400" style={{ marginLeft: "0.5vh", fontSize: "0.85em" }}>공지사항</span>
        </span>
      </div>
      <div className="flex items-center" style={{ gap: "1vh" }}>
        <div className="text-right text-slate-600" style={{ fontSize: "1.1vh", lineHeight: 1.4 }}>
          <div>{date}</div>
          <div>{weekday}요일</div>
        </div>
        <span
          className="font-extrabold text-slate-50 leading-none tracking-tighter"
          style={{ fontSize: "3.2vh", fontVariantNumeric: "tabular-nums" }}
        >
          {time}
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: update TopBar sizing for square container"
```

---

### Task 7: Remove old components and clean up

**Files:**
- Modify: `src/app/display/page.tsx` (remove `DetailPanel`, `ListPanel`, `NoticeItem`)

- [ ] **Step 1: Delete old components**

Remove the following functions entirely from `display/page.tsx`:
- `DetailPanel` (old left panel)
- `ListPanel` (old right panel with slider)
- `NoticeItem` (old list item)

Also remove unused constants at the top of the file:
- `TAP_PAUSE_MS` (replaced by `RETURN_MS`)
- `PAGE_SIZE = 5` (replaced by `PAGE_SIZE = 4`)
- `CARD_GAP_VH` (no longer used)

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "refactor: remove old 2-panel layout components"
```

---

### Task 8: Visual QA and polish

**Files:**
- Modify: `src/app/display/page.tsx` (adjustments based on visual testing)

- [ ] **Step 1: Run dev server and test**

Run: `npm run dev`

Open `http://localhost:3000/display` in a browser window resized to a 1:1 square aspect ratio. Verify:
1. Grid shows 4 tiles evenly
2. Touching a tile expands to fullscreen with spring animation
3. Grid borders are visible behind expanded tile (dimmed)
4. X button is visible top-right, closes on click
5. 60s inactivity returns to grid
6. Check button works with explosion effects
7. Link card opens iframe
8. Page auto-cycles every 10s when in grid view
9. Page cycling pauses during fullscreen
10. Page indicator shows correct page

- [ ] **Step 2: Fix any visual issues found**

Adjust padding, font sizes, or animation parameters as needed based on visual testing.

- [ ] **Step 3: Final commit**

```bash
git add src/app/display/page.tsx
git commit -m "style: polish grid layout for 1:1 display"
```
