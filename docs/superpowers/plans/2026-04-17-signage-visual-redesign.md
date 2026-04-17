# Signage Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/display` signage page with a deep navy + cyan color palette, 2-panel layout (40:60), auto-cycling notices, and large typography optimized for 40"+ touchscreen displays.

**Architecture:** Replace the current single-scroll grid layout with a fixed 100vh 2-panel layout: left panel shows selected notice detail, right panel shows 4 notice cards cycling automatically every 5 seconds. Touch a card to select it. Uses existing InstantDB real-time subscription + Framer Motion animations.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Framer Motion 12, InstantDB React

**Spec:** `docs/superpowers/specs/2026-04-17-signage-visual-redesign.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/globals.css` | Modify | Theme tokens (background, foreground colors) |
| `src/lib/categories.ts` | Modify | Category color values + new display-specific style properties |
| `src/app/display/page.tsx` | Rewrite | 2-panel layout, auto-cycle, touch selection, all display components |
| `src/app/page.tsx` | Modify | Minimal color adjustments for landing page |
| `src/app/layout.tsx` | Modify | Update body background class from zinc-950 to custom |
| `public/logo.png` | Create | Department logo image (user provides) |

---

### Task 1: Update Global Theme Tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update CSS theme tokens**

Replace the theme colors in `src/app/globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --color-background: #0f1219;
  --color-foreground: #f8fafc;
  --font-sans:
    "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
    "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

html,
body {
  background: var(--color-background);
  color: var(--color-foreground);
}

.signage-hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.signage-hide-scrollbar {
  scrollbar-width: none;
}
```

Changes: `--color-background` from `#09090b` to `#0f1219`, `--color-foreground` from `#fafafa` to `#f8fafc`.

- [ ] **Step 2: Update layout.tsx body class**

In `src/app/layout.tsx`, change:

```tsx
<body className="min-h-full bg-zinc-950 text-zinc-100 font-sans">
```

to:

```tsx
<body className="min-h-full bg-[#0f1219] text-slate-100 font-sans">
```

- [ ] **Step 3: Verify the app starts**

Run: `npm run dev`

Open `http://localhost:3000` — confirm the background is deep navy (`#0f1219`) not pure black.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "style: update theme to deep navy palette"
```

---

### Task 2: Update Category Styles

**Files:**
- Modify: `src/lib/categories.ts`

- [ ] **Step 1: Add display-specific style properties to CategoryStyle**

In `src/lib/categories.ts`, replace the `CategoryStyle` interface and `CATEGORY_STYLES` constant:

```typescript
import type { Category } from "./instant";

export interface CategoryStyle {
  label: string;
  /** Accent color hex value */
  color: string;
  /** Tailwind classes for the left color bar */
  dot: string;
  /** Tailwind classes for badge container */
  badge: string;
  /** Tailwind classes for card ring/outline */
  ring: string;
  /** CSS color for progress bar */
  progressColor: string;
  /** CSS background for active card in list */
  activeBg: string;
  /** CSS border color for active card */
  activeBorder: string;
  /** CSS background for detail panel glow */
  glowGradient: string;
}

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  긴급: {
    label: "긴급",
    color: "#f87171",
    dot: "bg-red-400",
    badge: "bg-red-400/15 text-red-400 border-red-400/20",
    ring: "",
    progressColor: "rgba(248,113,113,0.4)",
    activeBg: "#1e2030",
    activeBorder: "rgba(248,113,113,0.15)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(248,113,113,0.05) 0%, transparent 55%)",
  },
  휴강: {
    label: "휴강",
    color: "#fbbf24",
    dot: "bg-yellow-400",
    badge: "bg-yellow-400/10 text-yellow-400 border-yellow-400/15",
    ring: "",
    progressColor: "rgba(251,191,36,0.4)",
    activeBg: "#1e2520",
    activeBorder: "rgba(251,191,36,0.12)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(251,191,36,0.04) 0%, transparent 55%)",
  },
  일반: {
    label: "일반",
    color: "#22d3ee",
    dot: "bg-cyan-400",
    badge: "bg-cyan-400/10 text-cyan-400 border-cyan-400/15",
    ring: "",
    progressColor: "rgba(34,211,238,0.4)",
    activeBg: "#1e2a3d",
    activeBorder: "rgba(34,211,238,0.15)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(34,211,238,0.04) 0%, transparent 55%)",
  },
};
```

Keep all the helper functions (`formatRelative`, `formatAbsolute`, `isNoticeVisible`) unchanged.

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit`

Expected: No errors. The admin page also uses `CategoryStyle` — the new fields are additive, so existing usage of `dot`, `badge`, `ring` still works.

- [ ] **Step 3: Commit**

```bash
git add src/lib/categories.ts
git commit -m "style: update category styles for navy+cyan palette"
```

---

### Task 3: Rewrite Display Page — Layout Shell & Header

**Files:**
- Rewrite: `src/app/display/page.tsx`

This is the largest task. We rewrite the entire display page. The full code is provided across Tasks 3-5 as one file split for readability. **Do not commit until Task 5.**

- [ ] **Step 1: Write the top of display/page.tsx — imports, main component, and header**

Replace the entire `src/app/display/page.tsx` with:

```tsx
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
```

Continue in next step (same file).

---

### Task 4: Rewrite Display Page — Detail Panel

**Files:**
- Continue: `src/app/display/page.tsx` (append after TopBar)

- [ ] **Step 1: Add DetailPanel component**

Append to `src/app/display/page.tsx`:

```tsx
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
```

---

### Task 5: Rewrite Display Page — List Panel & Global CSS Animation

**Files:**
- Continue: `src/app/display/page.tsx` (append after DetailPanel)
- Modify: `src/app/globals.css` (add keyframe)

- [ ] **Step 1: Add ListPanel and NoticeItem components**

Append to `src/app/display/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Add CSS keyframes to globals.css**

Append to `src/app/globals.css`:

```css
/* Signage animations */
@keyframes livePulse {
  0%, 100% { box-shadow: 0 0 12px rgba(34,211,238,0.6); }
  50% { box-shadow: 0 0 24px rgba(34,211,238,0.9); }
}

@keyframes progressFill {
  from { width: 0; }
  to { width: 100%; }
}
```

- [ ] **Step 3: Verify the display page**

Run: `npm run dev`

Open `http://localhost:3000/display` and verify:
- 2-panel layout: left 40%, right 60%
- Deep navy background
- Cyan live indicator pulsing
- Brand shows "게임소프트웨어학과 공지사항" (logo will 404 until provided — that's OK)
- Cards auto-cycle every 5 seconds with progress bar
- Touching a card selects it and resets the timer
- Detail panel shows selected notice with fade animation

- [ ] **Step 4: Commit**

```bash
git add src/app/display/page.tsx src/app/globals.css
git commit -m "feat: rewrite display page with 2-panel signage layout"
```

---

### Task 6: Update Landing Page Colors

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update color classes**

In `src/app/page.tsx`, update the color classes to match the new palette:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
          Campus Notice Board
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-slate-100">
          캠퍼스 공지사항
        </h1>
        <p className="mt-3 text-slate-400">
          복도 디스플레이 및 관리자 페이지로 이동하세요.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/display"
          className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-medium text-slate-900 transition hover:bg-cyan-300"
        >
          디스플레이 보기 →
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-slate-600 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-400 hover:text-white"
        >
          관리자 로그인
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify landing page**

Open `http://localhost:3000` — confirm the primary button is cyan and page background is navy.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "style: update landing page to match navy+cyan palette"
```

---

### Task 7: Add Logo & Final Verification

**Files:**
- Create: `public/logo.png`

- [ ] **Step 1: Place logo file**

Ask the user for the logo image file and copy it to `public/logo.png`. The display header uses `<Image src="/logo.png" ... className="invert" />` to render it white on the dark background.

If the user has the file at a known path:
```bash
cp "/path/to/logo.png" public/logo.png
```

- [ ] **Step 2: Full verification**

Run: `npm run dev`

Verify all pages:
1. `http://localhost:3000` — landing page with cyan button, navy background
2. `http://localhost:3000/display` — full signage with:
   - Logo + "게임소프트웨어학과 공지사항" in header
   - Cyan live dot pulsing
   - 44px clock updating
   - Left panel: selected notice detail with glow
   - Right panel: 4 cards cycling every 5s
   - Touch selection works + resets timer
   - Progress bar animates on active card
3. `http://localhost:3000/admin` — admin page still works (colors slightly shifted from zinc to slate via globals.css)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add public/logo.png
git commit -m "feat: add department logo for signage header"
```
