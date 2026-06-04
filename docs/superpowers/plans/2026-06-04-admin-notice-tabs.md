# 관리자 공지 활성/비활성 탭 분리 — 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin` 공지 목록에 전체/활성/예정/종료 4탭을 추가하고 기본 진입 시 활성 탭이 선택되도록 한다.

**Architecture:** 분류 헬퍼를 `src/lib/notice-status.ts` 로 분리. `Dashboard` 가 `activeTab` 상태를 URL 해시와 동기화하고, 필터된 배열을 데스크톱 리스트와 `MobileListView` 양쪽에 전달. `NoticeTabs` 컴포넌트는 두 레이아웃에서 공유.

**Tech Stack:** Next.js (App Router) · React 클라이언트 컴포넌트 · framer-motion · InstantDB · TailwindCSS. 테스트 인프라 없음 — `npm run build` + `npx tsc --noEmit` + 수동 브라우저 검증.

**스펙:** `docs/superpowers/specs/2026-06-04-admin-notice-tabs-design.md`

---

## File Structure

| 파일 | 역할 | 변경 종류 |
| --- | --- | --- |
| `src/lib/notice-status.ts` | `NoticeStatus`/`NoticeTab` 타입, `getNoticeStatus`, `filterByTab`, `countByStatus` | **생성** |
| `src/app/admin/page.tsx` | `NoticeTabs` 컴포넌트 추가, `Dashboard` 에 탭 상태/URL 동기화/필터링 도입, 데스크톱+모바일 두 리스트 모두 탭 사용 | **수정** |

`src/lib/categories.ts` 의 `getEffectivePeriod` 를 그대로 재사용 — 수정 없음.

---

## Task 1: `notice-status` 헬퍼 모듈 생성

**Files:**
- Create: `src/lib/notice-status.ts`

- [ ] **Step 1: 헬퍼 파일 작성**

다음 내용으로 `src/lib/notice-status.ts` 생성.

```ts
import { getEffectivePeriod } from "@/lib/categories";
import type { Notice } from "@/lib/instant";

/** 공지의 게시 상태. */
export type NoticeStatus = "active" | "upcoming" | "expired";

/** 관리자 목록 탭. */
export type NoticeTab = "all" | NoticeStatus;

export const NOTICE_TABS: readonly NoticeTab[] = [
  "all",
  "active",
  "upcoming",
  "expired",
] as const;

const TAB_SET = new Set<NoticeTab>(NOTICE_TABS);

/** 임의 문자열이 유효한 탭 키인지 확인. */
export function isNoticeTab(value: string): value is NoticeTab {
  return TAB_SET.has(value as NoticeTab);
}

/**
 * 현재 시각 기준 공지 상태 판정.
 * 기간 계산은 categories.ts 의 getEffectivePeriod 를 사용 — 단일 정의.
 */
export function getNoticeStatus(notice: Notice, now: number): NoticeStatus {
  const { start, end } = getEffectivePeriod(notice);
  if (now < start) return "upcoming";
  if (now > end) return "expired";
  return "active";
}

/** 탭 기준으로 공지 배열 필터. "all" 은 입력 그대로 돌려준다. */
export function filterByTab(
  notices: Notice[],
  tab: NoticeTab,
  now: number,
): Notice[] {
  if (tab === "all") return notices;
  return notices.filter((n) => getNoticeStatus(n, now) === tab);
}

/** 상태별 카운트. all 키는 합계. */
export function countByStatus(
  notices: Notice[],
  now: number,
): Record<NoticeTab, number> {
  const counts: Record<NoticeTab, number> = {
    all: notices.length,
    active: 0,
    upcoming: 0,
    expired: 0,
  };
  for (const n of notices) {
    counts[getNoticeStatus(n, now)] += 1;
  }
  return counts;
}
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료. 새 파일이 import 한 `@/lib/categories`, `@/lib/instant` 가 정상 해석.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/notice-status.ts
git commit -m "[ADD] 공지 상태 분류 헬퍼 (notice-status)"
```

---

## Task 2: `NoticeTabs` 컴포넌트 추가

**Files:**
- Modify: `src/app/admin/page.tsx`

`SectionHeader` 정의 바로 위(파일 안 Subcomponents 영역) 에 새 함수 컴포넌트를 추가한다. 이 단계에서는 정의만 두고 아직 호출하지 않는다.

- [ ] **Step 1: import 에 탭 헬퍼 추가**

`src/app/admin/page.tsx` 상단의 `@/lib/ai-summary` import 아래에 추가:

```ts
import {
  NOTICE_TABS,
  isNoticeTab,
  type NoticeTab,
} from "@/lib/notice-status";
```

- [ ] **Step 2: `NoticeTabs` 컴포넌트 정의 추가**

`function SectionHeader({` 바로 위에 다음 코드를 삽입.

```ts
const TAB_LABELS: Record<NoticeTab, string> = {
  all: "전체",
  active: "활성",
  upcoming: "예정",
  expired: "종료",
};

function NoticeTabs({
  activeTab,
  counts,
  onChange,
}: {
  activeTab: NoticeTab;
  counts: Record<NoticeTab, number>;
  onChange: (tab: NoticeTab) => void;
}) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {NOTICE_TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition " +
              (isActive
                ? "border-blue-400/70 bg-blue-500/90 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.35)]"
                : "border-white/10 bg-zinc-900/40 text-zinc-400 hover:border-white/25 hover:text-zinc-100")
            }
          >
            <span>{TAB_LABELS[tab]}</span>
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                (isActive
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-zinc-500")
              }
            >
              {counts[tab]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 타입체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (컴포넌트는 아직 사용되지 않아 경고가 날 수 있으나 우리 tsconfig 는 `noUnusedLocals` 가 꺼져 있으므로 에러는 아님 — 확인된 사실. 만약 에러가 나면 Task 3 에서 사용 처리되므로 다음 단계로 진행해도 됨.)

- [ ] **Step 4: 커밋**

```bash
git add src/app/admin/page.tsx
git commit -m "[ADD] NoticeTabs 컴포넌트 (활성/예정/종료/전체)"
```

---

## Task 3: `Dashboard` 에 탭 상태/URL 동기화/필터링 적용

**Files:**
- Modify: `src/app/admin/page.tsx` (Dashboard 함수)

- [ ] **Step 1: import 에 필터/카운트 헬퍼 추가**

Task 2 에서 추가한 import 블록을 다음과 같이 확장.

```ts
import {
  NOTICE_TABS,
  countByStatus,
  filterByTab,
  isNoticeTab,
  type NoticeTab,
} from "@/lib/notice-status";
```

- [ ] **Step 2: Dashboard 안에 탭 상태 + URL 해시 동기화 + 필터 useMemo 추가**

`const notices: Notice[] = useMemo(() => data?.notices ?? [], [data]);` 줄 **바로 다음에** 아래 블록을 삽입.

```ts
  // ── 탭 (활성/예정/종료/전체) ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<NoticeTab>("active");

  // 마운트 시 URL 해시로 초기 탭 복원
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (isNoticeTab(hash)) {
      setActiveTab(hash);
    }
    function onHashChange() {
      const next = window.location.hash.replace(/^#/, "");
      if (isNoticeTab(next)) setActiveTab(next);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function handleTabChange(tab: NoticeTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      // 히스토리 스택은 더럽히지 않는다.
      window.history.replaceState(null, "", `#${tab}`);
    }
  }

  // 마운트 시점의 now 한 번만 잡아 일관 카운트/필터. InstantDB 데이터가
  // 업데이트되면 useMemo 가 다시 돌면서 자연스럽게 보정된다.
  const now = useMemo(() => Date.now(), [data]);
  const tabCounts = useMemo(
    () => countByStatus(notices, now),
    [notices, now],
  );
  const filteredNotices = useMemo(
    () => filterByTab(notices, activeTab, now),
    [notices, activeTab, now],
  );
```

- [ ] **Step 3: 데스크톱 리스트 영역을 탭 + 필터 결과로 교체**

`src/app/admin/page.tsx` 의 데스크톱 분기(현재 `{/* List */}` 주석으로 시작하는 `<section>`) 내부의 `<SectionHeader …/>` 와 빈 리스트 분기를 다음으로 교체.

기존:
```tsx
          <section>
            <SectionHeader
              title="등록된 공지"
              subtitle={`총 ${notices.length}건`}
            />
            {isLoading ? (
              <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
            ) : error ? (
              <p className="mt-4 text-sm text-red-400">{error.message}</p>
            ) : notices.length === 0 ? (
              <EmptyList />
            ) : (
              <ul className="mt-4 space-y-3">
                <AnimatePresence initial={false}>
                  {notices.map((n) => (
                    <NoticeRow
                      key={n.id}
                      notice={n}
                      active={form.id === n.id}
                      onEdit={() => startEdit(n)}
                      onDelete={() => handleDelete(n)}
                      onRegenerate={() => handleRegenerate(n)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
```

새 코드:
```tsx
          <section>
            <SectionHeader title="등록된 공지" />
            <div className="mt-4">
              <NoticeTabs
                activeTab={activeTab}
                counts={tabCounts}
                onChange={handleTabChange}
              />
            </div>
            {isLoading ? (
              <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
            ) : error ? (
              <p className="mt-4 text-sm text-red-400">{error.message}</p>
            ) : filteredNotices.length === 0 ? (
              <EmptyTab tab={activeTab} />
            ) : (
              <ul className="mt-4 space-y-3">
                <AnimatePresence initial={false}>
                  {filteredNotices.map((n) => (
                    <NoticeRow
                      key={n.id}
                      notice={n}
                      active={form.id === n.id}
                      onEdit={() => startEdit(n)}
                      onDelete={() => handleDelete(n)}
                      onRegenerate={() => handleRegenerate(n)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
```

- [ ] **Step 4: 모바일 분기에도 탭/필터 적용**

데스크톱 바로 아래의 `{layoutMode === "touch" && (` 블록에서 `MobileListView` 호출을 다음처럼 변경.

기존:
```tsx
            <MobileListView
              notices={notices}
              isLoading={isLoading}
              error={error}
              onEdit={startEdit}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
              onCreate={() => { reset(); setMobileView("form"); }}
            />
```

새 코드:
```tsx
            <MobileListView
              notices={filteredNotices}
              isLoading={isLoading}
              error={error}
              activeTab={activeTab}
              tabCounts={tabCounts}
              onTabChange={handleTabChange}
              onEdit={startEdit}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
              onCreate={() => { reset(); setMobileView("form"); }}
            />
```

- [ ] **Step 5: 타입체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: `MobileListView` 의 props 가 아직 새 시그니처에 맞지 않으므로 빨간 줄이 뜬다. 다음 태스크에서 해결. (`EmptyTab` 도 아직 없음.)

- [ ] **Step 6: 커밋 (실패하는 타입을 한 컷에 묶기 위해 다음 Task 완료 후 커밋. 이 단계에선 커밋 생략.)**

---

## Task 4: 빈 상태 컴포넌트 + `MobileListView` 시그니처 업데이트

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: `EmptyTab` 컴포넌트 추가**

기존 `EmptyList` 컴포넌트가 어딘가에 정의돼 있다. 그 정의 바로 아래(또는 같은 영역) 에 다음을 추가.

```ts
function EmptyTab({ tab }: { tab: NoticeTab }) {
  const messages: Record<NoticeTab, string> = {
    all: "등록된 공지가 없습니다.",
    active: "활성 공지가 없습니다.",
    upcoming: "예정된 공지가 없습니다.",
    expired: "종료된 공지가 없습니다.",
  };
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 px-6 py-10 text-center">
      <p className="text-sm text-zinc-400">{messages[tab]}</p>
    </div>
  );
}
```

- [ ] **Step 2: `MobileListView` 시그니처/내부 갱신**

`function MobileListView({` 부터 끝까지 다음으로 교체.

```tsx
function MobileListView({
  notices,
  isLoading,
  error,
  activeTab,
  tabCounts,
  onTabChange,
  onEdit,
  onDelete,
  onRegenerate,
  onCreate,
}: {
  notices: Notice[];
  isLoading: boolean;
  error: { message: string } | null | undefined;
  activeTab: NoticeTab;
  tabCounts: Record<NoticeTab, number>;
  onTabChange: (tab: NoticeTab) => void;
  onEdit: (n: Notice) => void;
  onDelete: (n: Notice) => void;
  onRegenerate: (n: Notice) => Promise<void>;
  onCreate: () => void;
}) {
  return (
    <div className="relative min-h-screen px-4 py-4">
      <SectionHeader title="등록된 공지" />
      <div className="mt-3">
        <NoticeTabs
          activeTab={activeTab}
          counts={tabCounts}
          onChange={onTabChange}
        />
      </div>
      {isLoading ? (
        <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error.message}</p>
      ) : notices.length === 0 ? (
        <EmptyTab tab={activeTab} />
      ) : (
        <ul className="mt-4 space-y-3 pb-24">
          <AnimatePresence initial={false}>
            {notices.map((n) => (
              <NoticeRow
                key={n.id}
                notice={n}
                active={false}
                onEdit={() => onEdit(n)}
                onDelete={() => onDelete(n)}
                onRegenerate={() => onRegenerate(n)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* FAB */}
      <button
        onClick={onCreate}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30 transition active:scale-95"
      >
        <span className="text-2xl font-bold">+</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 타입체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 프로덕션 빌드 확인**

Run: `npm run build`
Expected: 성공. `/admin` 라우트가 빌드되며 새 모듈이 번들에 포함됨. 경고는 무시 가능, 에러는 0.

- [ ] **Step 5: 커밋**

```bash
git add src/app/admin/page.tsx
git commit -m "[UPDATE] 관리자 공지 목록에 활성/예정/종료/전체 4탭 도입"
```

---

## Task 5: 수동 검증

**Files:**
- 변경 없음 (브라우저 검증)

이 프로젝트는 자동 테스트 인프라가 없으므로 수동 검증으로 마무리. 로컬 dev 서버에서 다음 시나리오를 차례로 확인한다.

- [ ] **Step 1: dev 서버 기동**

Run: `npm run dev`
Expected: Next.js dev 서버가 `localhost:3000` 등에서 기동.

- [ ] **Step 2: `/admin` 진입 동작**

브라우저에서 `/admin` 접속 → 비밀번호(`epls1`) 입력 → 목록 화면.

체크:
- [ ] 탭 4개(전체 / 활성 / 예정 / 종료)가 노출되고 각 카운트 뱃지가 보인다.
- [ ] 진입 직후 **활성** 탭이 선택돼 있다.
- [ ] URL 끝에 `#active` 가 자동 부여되거나, 사용자가 다른 탭 클릭 시 그에 맞는 해시(`#expired` 등)로 갱신된다.

- [ ] **Step 3: 새로고침 시 탭 복원**

`#expired` 가 붙은 상태에서 새로고침 → 종료 탭이 그대로 선택돼 있는지 확인.

- [ ] **Step 4: 탭별 표시**

각 탭에 들어가서:
- [ ] 활성: 현재 게시 중인 공지만 보인다 (시작일 ≤ 오늘 ≤ 종료일).
- [ ] 예정: 시작일이 미래인 공지만 보인다.
- [ ] 종료: 종료일이 지난 공지만 보인다.
- [ ] 전체: 모든 공지가 createdAt 내림차순으로 보인다.

- [ ] **Step 5: 빈 상태**

해당 상태 공지가 없는 탭으로 이동 → "예정 공지가 없습니다." 같은 메시지가 표시된다.

- [ ] **Step 6: 등록/수정 후 탭 유지**

- 종료 탭 상태에서 새 공지 등록 → 종료 탭에 그대로 머무름. 새 공지는 활성/예정 탭에서 보인다.
- 종료 공지를 편집 → 저장 후에도 종료 탭 유지.

- [ ] **Step 7: 모바일 레이아웃**

브라우저 창을 1280px 미만으로 줄이면 터치 레이아웃으로 전환. 같은 탭 UI 가 모바일에서도 보이고 동작하는지 확인.

- [ ] **Step 8: 검증 완료 후 PR 단계로 인계**

위 항목이 전부 OK 면 작업 종료. (PR 생성/머지는 사용자 지시에 따른다. 이 플랜은 master 직접 푸시를 하지 않는다.)
