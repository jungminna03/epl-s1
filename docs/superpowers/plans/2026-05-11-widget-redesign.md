# Widget Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/widget` 라우트를 Figma 기반 미니멀 카드 UI 로 교체하고, 카드 클릭 시 외부 브라우저로 `/display` 를 열며, 1시간 사이클 로컬 읽음 상태로 카드 우상단 빨간 점·좌하단 안 읽음 카운트 배지를 표시한다.

**Architecture:** 단일 페이지 컴포넌트 (`src/app/widget/page.tsx`) 가 `db.useQuery` 로 공지 목록을 받아 4 슬롯 그리드에 렌더하고, 공지가 5개 이상일 때 10초마다 페이지를 자동 회전한다. 읽음 상태는 순수 함수 모듈 (`src/lib/widget-read-state.ts`) 로 분리해 `localStorage` 와 분리된 형태로 다룬다. 위젯 페이지의 30초 시계 인터벌이 시계 표시와 읽음 상태 리셋 체크를 동시에 트리거하는 단일 흐름. 마퀴(좌측 슬라이드) 는 framer-motion 의 `animate` + `repeat: Infinity` 로 구현. `/display` 는 본 작업에서 변경하지 않는다.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · framer-motion 12 · InstantDB · Electron 42 (renderer host). 새 npm 의존성 추가는 금지 (CLAUDE.md 룰).

**Spec:** `docs/superpowers/specs/2026-05-11-widget-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/widget-read-state.ts` | Create | 순수 함수 + localStorage 직렬화 — `loadReadState`, `saveReadState`, `maybeReset`, `markRead`. UI 의존성 없음. |
| `src/app/widget/page.tsx` | Replace (현재 30줄 placeholder 전체 교체) | 위젯 페이지 — 데이터 fetch, 헤더, 카드 그리드, 페이지 회전, 마퀴 텍스트, 빨간 점·배지, 외부 브라우저 열기, PinToggle. |

다른 파일은 절대 건드리지 않는다. `/display`, `/admin`, `electron/*`, `src/lib/instant.ts`, `src/lib/categories.ts`, IPC 표면, 인스톨러, 자동 업데이트 전부 그대로.

---

## 검증 방식 (이 프로젝트 컨텍스트)

- **단위 테스트 인프라 없음** — vitest/jest 등 도입은 외부 의존성 룰에 막힘
- **외부 의존성 추가 금지** — `node:test` 도 TS 컴파일 토오링 없이는 비실용적
- **대안 사이클**: 각 task 마다
  1. `npx tsc --noEmit` 통과 (타입체크)
  2. `npm run dev` 또는 `npm run electron:dev` 로 브라우저/위젯 시각 확인 (수동 시나리오 명시됨)
  3. `git commit`
- `widget-read-state.ts` 같은 순수 로직은 시각 확인이 어려워 마지막 task 에서 DevTools console 로 직접 함수 호출해 동작 확인

---

## Task 1: 읽음 상태 헬퍼 모듈

**Files:**
- Create: `src/lib/widget-read-state.ts`

순수 함수 + localStorage I/O. UI 의존성 없음. SSR 안전.

- [ ] **Step 1: 파일 생성**

`src/lib/widget-read-state.ts`:

```ts
/**
 * 위젯 카드의 "읽음" 상태를 클라이언트 로컬에 저장한다.
 * - PC별 독립 (InstantDB 동기화 안 함 — 익명 위젯이라 부적합)
 * - 1시간 마다 전역 일괄 리셋 → 모든 공지가 다시 "안 읽음" 상태로 부활
 *
 * 컨슈머: src/app/widget/page.tsx 의 useReadState 훅
 */

const STORAGE_KEY = "epl-widget-read-state";
const RESET_INTERVAL_MS = 60 * 60 * 1000;

export type ReadState = {
  /** 마지막 리셋 시각(ms). 이 시점 이후 클릭한 공지 id 만 readIds 에 있음. */
  resetAt: number;
  /** 현 사이클에서 읽은 공지 id 집합. */
  readIds: Set<string>;
};

type SerializedState = {
  resetAt: number;
  readIds: string[];
};

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

/** 초기 상태 — resetAt 만 now, readIds 는 비어있음. */
function freshState(now: number): ReadState {
  return { resetAt: now, readIds: new Set() };
}

/** localStorage 에서 상태를 불러온다. SSR/파싱실패/quota 모두 freshState 폴백. */
export function loadReadState(now: number = Date.now()): ReadState {
  if (!isBrowser()) return freshState(now);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState(now);
    const parsed = JSON.parse(raw) as SerializedState;
    if (
      typeof parsed.resetAt !== "number" ||
      !Array.isArray(parsed.readIds)
    ) {
      return freshState(now);
    }
    return {
      resetAt: parsed.resetAt,
      readIds: new Set(parsed.readIds.filter((x) => typeof x === "string")),
    };
  } catch {
    return freshState(now);
  }
}

/** 상태를 localStorage 에 직렬화 저장. quota/SSR 등은 조용히 무시. */
export function saveReadState(state: ReadState): void {
  if (!isBrowser()) return;
  const serialized: SerializedState = {
    resetAt: state.resetAt,
    readIds: Array.from(state.readIds),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // localStorage quota 초과 / private mode — 위젯은 그대로 동작
  }
}

/** 1시간 경과했으면 리셋된 새 상태 반환. 아니면 원본 그대로. */
export function maybeReset(state: ReadState, now: number): ReadState {
  if (now - state.resetAt > RESET_INTERVAL_MS) {
    return freshState(now);
  }
  return state;
}

/** 공지를 "읽음" 으로 표시. 이미 있으면 원본 그대로 (불필요한 리렌더 방지). */
export function markRead(state: ReadState, id: string): ReadState {
  if (state.readIds.has(id)) return state;
  const next = new Set(state.readIds);
  next.add(id);
  return { resetAt: state.resetAt, readIds: next };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없이 종료 (exit code 0).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/widget-read-state.ts
git commit -m "feat(widget): 읽음 상태 헬퍼 모듈 — 1시간 사이클 + localStorage"
```

---

## Task 2: 위젯 페이지 스캐폴드 (헤더 + 빈 슬롯)

**Files:**
- Modify (전체 교체): `src/app/widget/page.tsx`

데이터 로드, 시계 갱신, 헤더, 빈 4슬롯, 로딩/에러 분기까지. 카드 내용·마퀴·읽음 상태는 아직.

- [ ] **Step 1: 파일 전체 교체**

`src/app/widget/page.tsx` 의 현재 내용을 전부 삭제하고 아래로 교체:

```tsx
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

/* ─── Notice Grid (slots only, no cards yet) ─── */

function NoticeGrid({ notices: _notices }: { notices: Notice[] }) {
  // Task 3 에서 NoticeCard 채움. 여기선 일단 빈 슬롯 4개.
  return <EmptySlots />;
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 3: 시각 확인 (브라우저)**

Run: `npm run dev`

브라우저에서 `http://localhost:3000/widget` 열고 확인:
- 다크 그레이 배경, 1.5vh 패딩
- 상단에 `v0.2.0` (좌) / `YYYY/MM/DD (요일)` (우)
- 그 아래에 메가폰 + "게임소프트웨어학과 공지 사항" (좌) / 큰 시간 (우)
- 본문에 빈 슬롯 4개 (균등 4등분, 살짝 톤 다운된 카드 모양만)
- 30초 후 시계 자동 갱신

데이터 fetch 가 가능하면 그냥 빈 4슬롯이 보임 (NoticeGrid 가 아직 카드를 안 그림). 에러 시 빨간 박스.

확인 후 `Ctrl+C` 로 종료.

- [ ] **Step 4: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "feat(widget): Figma 기반 스캐폴드 — 다크 외곽 + 헤더 + 빈 4슬롯"
```

---

## Task 3: 공지 카드 채우기 (제목 truncate)

**Files:**
- Modify: `src/app/widget/page.tsx`

`NoticeGrid` 가 실제 공지로 4슬롯을 채우게. 마퀴 없이 일단 `truncate` 로 잘림.

- [ ] **Step 1: NoticeGrid + NoticeCard 추가**

`src/app/widget/page.tsx` 의 `NoticeGrid` 함수를 아래로 교체하고, `EmptySlots` 함수 바로 위에 `NoticeCard` 추가:

```tsx
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 3: 시각 확인**

Run: `npm run dev`

`http://localhost:3000/widget` 에서:
- InstantDB 에 공지가 있으면 최신순 4개가 카드로 표시 (제목만, 굵은 흰 글씨)
- 긴 제목은 `...` 으로 잘림 (마퀴는 Task 6 에서)
- 공지가 4개 미만이면 빈 슬롯이 비어있음
- 공지 5개 이상이어도 일단 처음 4개만 표시 (자동 회전은 Task 4)

확인 후 종료.

- [ ] **Step 4: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "feat(widget): 공지 카드 채우기 — 제목 표시 (truncate)"
```

---

## Task 4: 페이지 자동 회전 (공지 > 4)

**Files:**
- Modify: `src/app/widget/page.tsx`

공지가 5개 이상이면 10초마다 페이지가 자동으로 회전. 인디케이터 없음.

- [ ] **Step 1: NoticeGrid 에 페이지 회전 로직 추가**

`src/app/widget/page.tsx` 의 `NoticeGrid` 함수 + 상수를 아래로 교체:

```tsx
/* ─── Notice Grid ─── */

const PAGE_SIZE = 4;
const PAGE_CYCLE_MS = 10_000;

function NoticeGrid({ notices }: { notices: Notice[] }) {
  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const [pageIdx, setPageIdx] = useState(0);

  // notices 가 줄어들어 pageIdx 가 범위 밖이 되면 클램프
  useEffect(() => {
    setPageIdx((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  // 자동 회전 (페이지 2개 이상일 때만)
  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPageIdx((p) => (p + 1) % totalPages);
    }, PAGE_CYCLE_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  const start = pageIdx * PAGE_SIZE;
  const pageNotices = notices.slice(start, start + PAGE_SIZE);

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
              key={`empty-${pageIdx}-${i}`}
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
```

`useState`, `useEffect` 가 이미 `useEffect` 만 import 되어 있는지 확인. `useState` 가 import 라인에 없으면 추가:

```tsx
import { useEffect, useState } from "react";
```

(Task 2 에서 이미 둘 다 import 됨 — 그대로 두면 OK)

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 3: 시각 확인**

Run: `npm run dev`

`http://localhost:3000/widget`:
- 공지가 5개 이상이면 10초마다 다음 페이지로 자동 전환 (페이지 1 → 페이지 2 → ... → 페이지 1 순환)
- 공지가 4개 이하이면 회전 없이 고정
- 페이지 인디케이터는 없음 — 미니멀 톤 유지
- 전환은 즉시 (트랜지션 효과는 OOS)

InstantDB 에 5개 이상이 없으면 admin 페이지에서 추가하거나, 한시적으로 `notices` 슬라이스를 통해 시뮬레이션 가능 (테스트 후 원복).

- [ ] **Step 4: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "feat(widget): 공지 5개 이상일 때 10초마다 페이지 자동 회전"
```

---

## Task 5: 카드 클릭 → 외부 브라우저로 /display 열기

**Files:**
- Modify: `src/app/widget/page.tsx`

NoticeCard 가 클릭 가능해지고, 클릭 시 기본 브라우저(크롬 등) 에서 `/display` 가 열림. Electron 환경에서는 `window.epl.openExternal`, 일반 웹에선 `window.open` fallback.

- [ ] **Step 1: openDisplay 헬퍼 + NoticeCard 클릭 핸들러 추가**

`src/app/widget/page.tsx` 의 `NoticeCard` 함수를 아래로 교체:

```tsx
/* ─── External Display Opener ─── */

function openDisplay() {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/display`;
  const epl = (
    window as Window & { epl?: { openExternal: (u: string) => void } }
  ).epl;
  if (epl?.openExternal) {
    epl.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/* ─── Notice Card ─── */

function NoticeCard({ notice }: { notice: Notice }) {
  return (
    <button
      type="button"
      onClick={() => openDisplay()}
      className="relative flex w-full items-center overflow-hidden rounded-[1.8vh] text-left transition-transform active:scale-[0.99]"
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
    </button>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 3: 시각 확인 (웹)**

Run: `npm run dev`

`http://localhost:3000/widget`:
- 카드에 마우스 오버 시 커서가 포인터로 바뀜 (button)
- 카드 클릭 → 새 탭에서 `http://localhost:3000/display` 열림
- 누를 때 살짝 줄어드는 active 스케일

- [ ] **Step 4: 시각 확인 (Electron)** — *옵션, 가능하면 함*

Run: `npm run electron:dev`

위젯 창에서 카드 클릭 → 기본 브라우저(크롬 등) 새 탭에서 `https://localhost:3000/display` 가 열림. 위젯 창은 그대로.

- [ ] **Step 5: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "feat(widget): 카드 클릭 시 외부 브라우저로 /display 열기"
```

---

## Task 6: 제목 마퀴 (좌측 슬라이드)

**Files:**
- Modify: `src/app/widget/page.tsx`

제목 텍스트 폭이 카드 내부 폭을 넘으면 좌측으로 흘러가는 무한 슬라이드. 안 넘으면 정적.

- [ ] **Step 1: framer-motion import + MarqueeTitle 컴포넌트 추가**

`src/app/widget/page.tsx` 파일 최상단 import 영역에 framer-motion 추가:

```tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { db, type Notice } from "@/lib/instant";
import { isNoticeVisible } from "@/lib/categories";
```

(`useLayoutEffect` 와 `useRef` 도 추가됨)

그리고 `NoticeCard` 함수 바로 위에 `MarqueeTitle` 컴포넌트 추가:

```tsx
/* ─── Marquee Title ─── */

const MARQUEE_SPEED_PX_PER_S = 30;
const MARQUEE_GAP_VH = 4; // 텍스트 2회 반복 사이 간격

function MarqueeTitle({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  // 폭 측정 — text/font 가 바뀔 때마다 다시
  useLayoutEffect(() => {
    function measure() {
      const c = containerRef.current;
      const t = textRef.current;
      if (!c || !t) return;
      const containerWidth = c.clientWidth;
      const textWidth = t.scrollWidth;
      setOverflowPx(Math.max(0, textWidth - containerWidth));
    }
    measure();
    // 위젯 창 크기 변경/줌 변경에 대응
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text]);

  const isOverflow = overflowPx > 0;

  if (!isOverflow) {
    return (
      <div ref={containerRef} className="min-w-0 flex-1">
        <span
          ref={textRef}
          className="block truncate font-extrabold text-white leading-[1.15]"
          style={{
            fontSize: "3.4vh",
            letterSpacing: "-0.05vh",
          }}
        >
          {text}
        </span>
      </div>
    );
  }

  // 두 번째 텍스트가 첫 번째 시작 지점으로 끊김 없이 이어지도록
  // 한 사이클 거리 = 첫 텍스트 폭 + gap. 측정 단순화를 위해 overflowPx 기준 사용.
  const cycleDistance = overflowPx + 16; // overflowPx 만 흐르고 잠시 멈춤
  const duration = cycleDistance / MARQUEE_SPEED_PX_PER_S;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 overflow-hidden">
      <motion.div
        className="flex shrink-0"
        style={{ gap: `${MARQUEE_GAP_VH}vh`, width: "max-content" }}
        animate={{ x: [0, -cycleDistance] }}
        transition={{
          duration,
          ease: "linear",
          repeat: Infinity,
          repeatType: "loop",
          repeatDelay: 1,
        }}
      >
        <span
          ref={textRef}
          className="block whitespace-nowrap font-extrabold text-white leading-[1.15]"
          style={{
            fontSize: "3.4vh",
            letterSpacing: "-0.05vh",
          }}
        >
          {text}
        </span>
        <span
          aria-hidden
          className="block whitespace-nowrap font-extrabold text-white leading-[1.15]"
          style={{
            fontSize: "3.4vh",
            letterSpacing: "-0.05vh",
          }}
        >
          {text}
        </span>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: NoticeCard 가 MarqueeTitle 사용하도록 교체**

`src/app/widget/page.tsx` 의 `NoticeCard` 함수를 아래로 교체:

```tsx
/* ─── Notice Card ─── */

function NoticeCard({ notice }: { notice: Notice }) {
  return (
    <button
      type="button"
      onClick={() => openDisplay()}
      className="relative flex w-full items-center overflow-hidden rounded-[1.8vh] text-left transition-transform active:scale-[0.99]"
      style={{
        background: "#4a4d55",
        padding: "0 2.5vh",
      }}
    >
      <MarqueeTitle text={notice.title} />
    </button>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 4: 시각 확인**

Run: `npm run dev`

`http://localhost:3000/widget`:
- **짧은 제목** (예: "공지 사항 1") → 정적 표시, 잘림 없음
- **긴 제목** (예: "2026학년도 1학기 게임소프트웨어학과 종강 안내 및 학사 일정 변경 공지사항") → 좌측으로 일정 속도로 슬라이드, 다 흘러가면 1초 정지 후 다시 시작
- 위젯 창 크기를 키우거나 줄여서 같은 제목이 overflow 가 되었다 안 되었다 하는지 확인 (ResizeObserver 동작)

긴 제목이 없으면 admin 에서 임시로 길게 등록 후 테스트, 끝나면 원복.

- [ ] **Step 5: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "feat(widget): 긴 제목 좌측 마퀴 슬라이드 (overflow 시에만)"
```

---

## Task 7: 읽음 상태 + 빨간 점 + 좌하단 안 읽음 배지

**Files:**
- Modify: `src/app/widget/page.tsx`

`useReadState` 훅으로 localStorage 의 읽음 상태를 관리하고, 안 읽은 카드에 빨간 점을, 위젯 좌하단에 안 읽음 카운트 배지를 표시한다. 카드 클릭 시 `markRead` 호출.

- [ ] **Step 1: useReadState 훅 + UnreadDot + UnreadBadge 추가**

`src/app/widget/page.tsx` import 영역에 read-state 추가:

```tsx
"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { db, type Notice } from "@/lib/instant";
import { isNoticeVisible } from "@/lib/categories";
import {
  loadReadState,
  saveReadState,
  maybeReset,
  markRead as markReadInState,
  type ReadState,
} from "@/lib/widget-read-state";
```

(`useCallback`, `useMemo` 추가)

`MarqueeTitle` 컴포넌트 아래(또는 파일 어디든 적절한 위치) 에 훅 + 컴포넌트 추가:

```tsx
/* ─── Read State Hook ─── */

function useReadState(
  allNoticeIds: readonly string[],
  now: number,
): {
  readIds: Set<string>;
  unreadCount: number;
  markRead: (id: string) => void;
} {
  const [state, setState] = useState<ReadState>(() => ({
    resetAt: now,
    readIds: new Set(),
  }));

  // 마운트 후 localStorage 에서 1회 로드 (SSR 안전)
  useEffect(() => {
    const loaded = maybeReset(loadReadState(Date.now()), Date.now());
    setState(loaded);
    saveReadState(loaded);
  }, []);

  // now 가 변할 때마다 (30초) 1시간 사이클 체크
  useEffect(() => {
    setState((prev) => {
      const next = maybeReset(prev, now);
      if (next !== prev) saveReadState(next);
      return next;
    });
  }, [now]);

  const markRead = useCallback((id: string) => {
    setState((prev) => {
      const next = markReadInState(prev, id);
      if (next !== prev) saveReadState(next);
      return next;
    });
  }, []);

  const unreadCount = useMemo(
    () => allNoticeIds.filter((id) => !state.readIds.has(id)).length,
    [allNoticeIds, state.readIds],
  );

  return { readIds: state.readIds, unreadCount, markRead };
}

/* ─── Unread Dot ─── */

function UnreadDot() {
  return (
    <span
      aria-label="안 읽음"
      className="absolute rounded-full"
      style={{
        top: "0.8vh",
        right: "0.8vh",
        width: "1.2vh",
        height: "1.2vh",
        background: "#ef4444",
      }}
    />
  );
}

/* ─── Unread Badge (bottom-left) ─── */

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div
      aria-label={`안 읽은 공지 ${count}개`}
      className="absolute flex items-center justify-center rounded-full font-extrabold text-white"
      style={{
        left: "1.5vh",
        bottom: "1.5vh",
        minWidth: "2.6vh",
        height: "2.6vh",
        padding: "0 0.7vh",
        background: "#ef4444",
        fontSize: "1.4vh",
        boxShadow: "0 0.2vh 0.6vh rgba(0,0,0,0.3)",
      }}
    >
      {count > 99 ? "99+" : count}
    </div>
  );
}
```

- [ ] **Step 2: WidgetPage 가 useReadState 사용하고 카드/배지에 연결**

`WidgetPage` 함수, `NoticeGrid` 함수, `NoticeCard` 함수를 아래 일관된 형태로 교체:

```tsx
export default function WidgetPage() {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const notices = useMemo(() => {
    if (!data?.notices) return [];
    return data.notices.filter((n) => isNoticeVisible(n, now));
  }, [data, now]);

  const visibleIds = useMemo(() => notices.map((n) => n.id), [notices]);
  const { readIds, unreadCount, markRead } = useReadState(visibleIds, now);

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

  return (
    <WidgetFrame>
      <WidgetHeader now={now} />
      <NoticeGrid notices={notices} readIds={readIds} onCardClick={markRead} />
      <UnreadBadge count={unreadCount} />
    </WidgetFrame>
  );
}
```

`NoticeGrid`:

```tsx
function NoticeGrid({
  notices,
  readIds,
  onCardClick,
}: {
  notices: Notice[];
  readIds: Set<string>;
  onCardClick: (id: string) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const [pageIdx, setPageIdx] = useState(0);

  useEffect(() => {
    setPageIdx((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPageIdx((p) => (p + 1) % totalPages);
    }, PAGE_CYCLE_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  const start = pageIdx * PAGE_SIZE;
  const pageNotices = notices.slice(start, start + PAGE_SIZE);

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
              key={`empty-${pageIdx}-${i}`}
              className="rounded-[1.8vh]"
              style={{ background: "rgba(74,77,85,0.25)" }}
            />
          );
        }
        return (
          <NoticeCard
            key={notice.id}
            notice={notice}
            isUnread={!readIds.has(notice.id)}
            onClick={() => onCardClick(notice.id)}
          />
        );
      })}
    </div>
  );
}
```

`NoticeCard`:

```tsx
function NoticeCard({
  notice,
  isUnread,
  onClick,
}: {
  notice: Notice;
  isUnread: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        openDisplay();
      }}
      className="relative flex w-full items-center overflow-hidden rounded-[1.8vh] text-left transition-transform active:scale-[0.99]"
      style={{
        background: "#4a4d55",
        padding: "0 2.5vh",
      }}
    >
      <MarqueeTitle text={notice.title} />
      {isUnread && <UnreadDot />}
    </button>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 4: 시각 확인 (브라우저)**

Run: `npm run dev`

`http://localhost:3000/widget`:
- 처음 진입 시 모든 카드 우상단에 빨간 점 ●, 위젯 좌하단에 빨간 원 + 전체 안 읽음 수
- 카드 하나 클릭 → 빨간 점 사라짐, 좌하단 카운트 -1, 새 탭에서 `/display` 열림
- DevTools → Application → localStorage → `epl-widget-read-state` 값 확인:
  - `{ "resetAt": <어떤 ms>, "readIds": ["<클릭한 id>"] }` 형태로 저장됨
- 페이지 새로고침 → 클릭한 카드는 빨간 점 없이 유지 (상태 복원)
- 100개 넘는 시나리오는 OOS — 99+ 까지만 표시되는 코드 동작 확인은 옵션

- [ ] **Step 5: 1시간 사이클 수동 검증**

DevTools → Application → localStorage 에서 `epl-widget-read-state` 의 `resetAt` 값을 1시간 + 5분 전 ms (`Date.now() - 65*60*1000`) 로 직접 편집:
- DevTools Console 에서:
  ```js
  localStorage.setItem(
    "epl-widget-read-state",
    JSON.stringify({ resetAt: Date.now() - 65 * 60 * 1000, readIds: ["fake-id-1", "fake-id-2"] })
  );
  ```
- 페이지 새로고침 → 30초 안에 자동 리셋되어 모든 빨간 점 부활, 카운트 = 전체 가시 공지 수
- (즉시 보고 싶으면 새로고침 직후 한 번 더 새로고침 — 마운트 effect 가 리셋 적용)

- [ ] **Step 6: 커밋**

```bash
git add src/app/widget/page.tsx src/lib/widget-read-state.ts
git commit -m "feat(widget): 1시간 사이클 읽음 상태 — 카드 빨간 점 + 좌하단 안 읽음 배지"
```

---

## Task 8: PinToggle (맨 뒤 레이어 토글)

**Files:**
- Modify: `src/app/widget/page.tsx`

`/display` 에 있는 PinToggle 과 동일한 동작 — Electron 환경에서만 노출. 위젯 우상단 (헤더 시간 옆) 작게 배치.

- [ ] **Step 1: PinToggle 컴포넌트 추가**

`src/app/widget/page.tsx` 의 컴포넌트 정의 영역 (마지막 컴포넌트 뒤가 자연스러움) 에 추가:

```tsx
/* ─── Pin Toggle ─── */

type EplApi = {
  setAlwaysOnTop?: (value: boolean) => void;
};

function getEpl(): EplApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { epl?: EplApi }).epl;
}

function PinToggle() {
  const [available, setAvailable] = useState(false);
  const [pinned, setPinned] = useState(true);

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
      type="button"
      onClick={togglePinned}
      title={pinned ? "맨 뒤 레이어로 보내기" : "맨 앞 레이어로 가져오기"}
      className="absolute flex items-center justify-center rounded-full transition-opacity hover:opacity-100"
      style={{
        top: "1.2vh",
        right: "1.2vh",
        width: "2.8vh",
        height: "2.8vh",
        zIndex: 40,
        background: "rgba(248,250,252,0.08)",
        border: "1px solid rgba(248,250,252,0.14)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        opacity: pinned ? 0.5 : 0.9,
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
          <>
            <rect x="4" y="4" width="12" height="12" rx="1" />
            <path d="M20 10 v9 M20 19 l-3 -3 M20 19 l3 -3" />
          </>
        ) : (
          <>
            <rect x="8" y="8" width="12" height="12" rx="1" />
            <path d="M4 14 v-9 M4 5 l-3 3 M4 5 l3 3" />
          </>
        )}
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: WidgetFrame 안에 PinToggle 배치**

`WidgetFrame` 안에 `{children}` 위로 `PinToggle` 을 두는 게 절대 위치 기준 (`absolute top/right`) 으로 동작. `WidgetFrame` 을 아래로 교체:

```tsx
function WidgetFrame({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: "#2a2d33", padding: "1.5vh" }}
    >
      <PinToggle />
      {children}
    </main>
  );
}
```

- [ ] **Step 3: 헤더의 우상단 영역이 PinToggle 과 겹치지 않게 조정**

`WidgetHeader` 의 첫 번째 줄 (버전 + 날짜) 의 우측에 PinToggle 이 떠 있으므로, 날짜 표시가 가려질 수 있음. `WidgetHeader` 의 첫 줄 우측에 PinToggle 자리만큼 (`paddingRight: 3.6vh`) 여백을 둠. `WidgetHeader` 의 첫 `<div className="flex items-center justify-between">` 에 `style={{ paddingRight: "3.6vh" }}` 추가:

```tsx
<div
  className="flex items-center justify-between"
  style={{ paddingRight: "3.6vh" }}
>
  <span className="text-slate-400" style={{ fontSize: "1vh" }}>
    {VERSION_LABEL}
  </span>
  <span className="text-slate-400" style={{ fontSize: "1.3vh" }}>
    {yyyy}/{mm}/{dd} ({weekday})
  </span>
</div>
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 5: 시각 확인 (Electron 필요)**

Run: `npm run electron:dev`

위젯 창에서:
- 우상단 헤더 영역에 작은 핀 버튼이 보임 (날짜와 겹치지 않게 패딩)
- 클릭 → 위젯이 다른 창들 뒤로 (always on top 해제)
- 한 번 더 클릭 → 다시 위젯이 맨 앞으로
- 웹 (`npm run dev`) 에서는 PinToggle 이 안 보임 (`available = false`)

- [ ] **Step 6: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "feat(widget): PinToggle 유지 — 우상단 작게, Electron 에서만 노출"
```

---

## Task 9: 종합 검증 + 빌드

**Files:**
- 코드 변경 없음 (필요 시 미세 조정)

전체 시나리오를 한 번에 돌리고 프로덕션 빌드가 통과하는지 확인.

- [ ] **Step 1: 타입체크 한 번 더**

Run: `npx tsc --noEmit`

Expected: 에러 없음.

- [ ] **Step 2: Next.js 프로덕션 빌드**

Run: `npm run build`

Expected: 빌드 성공, `/widget` 라우트가 빌드된 페이지 목록에 포함.

만약 빌드 에러 발생 시:
- React server/client 경계 문제 (`"use client"` 누락 등) → 파일 최상단 `"use client"` 가 있는지 재확인
- localStorage 접근이 SSR 시점에 실행되지 않는지 확인 (모두 `isBrowser()` / `useEffect` 안에 있어야 함)
- framer-motion / InstantDB 사용이 모두 클라이언트 컴포넌트 안인지 확인

- [ ] **Step 3: Electron 통합 시각 확인**

Run: `npm run electron:dev`

위젯 창에서 모든 시나리오를 한 번에:
1. 헤더에 버전/날짜/학과명/시간/PinToggle 모두 정상
2. 짧은 제목 카드 → 정적
3. 긴 제목 카드 → 마퀴 슬라이드
4. 카드 우상단 빨간 점 (안 읽음일 때)
5. 좌하단 빨간 배지 (전체 안 읽음 수)
6. 카드 클릭 → 빨간 점 사라짐, 카운트 -1, 기본 브라우저에서 `/display` 열림
7. 공지 5개 이상 → 10초마다 페이지 회전
8. 공지 3개 → 4번째 슬롯 빈 박스
9. PinToggle 클릭 → 위젯이 뒤로/앞으로
10. `/display` 는 변경 없이 그대로 (위젯과 별개)

- [ ] **Step 4: 1시간 사이클 최종 검증**

위젯에서 일부 카드 클릭 후 (빨간 점 사라진 상태), DevTools Console:

```js
localStorage.setItem(
  "epl-widget-read-state",
  JSON.stringify({ resetAt: Date.now() - 65 * 60 * 1000, readIds: ["any-id"] })
);
```

→ 페이지 새로고침 → 다시 모든 빨간 점 부활, 좌하단 카운트가 전체 공지 수와 같음

- [ ] **Step 5: 필요 시 마이크로 조정 + 최종 커밋**

시각 확인 중 발견한 사소한 톤/간격 문제만 fix. 큰 구조 변경은 별도 spec/plan.

수정한 게 있다면:

```bash
git add src/app/widget/page.tsx
git commit -m "fix(widget): 종합 검증 후 미세 조정"
```

수정 없으면 이 커밋은 생략.

- [ ] **Step 6: 최종 상태 확인**

Run: `git log --oneline -10`

Expected: Task 1~8 (필요 시 9) 의 커밋이 시간 순으로 보임. master 브랜치 위로 깨끗하게 쌓임.

Run: `git status`

Expected: `nothing to commit, working tree clean`.

---

## 완료 후

- 사이니지 PC (`/display`) 외관 변경 없음을 한 번 더 확인
- 위젯 새 빌드는 다음 `npm run release` 시 배포 — 본 plan 의 OOS
- `VERSION_LABEL` 상수 (`v0.2.0`) 는 `package.json` 의 version 과 손으로 맞춰 둠. 향후 자동화는 별도 작업.
