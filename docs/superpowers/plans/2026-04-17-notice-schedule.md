# 공지 게시 기간 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin이 공지별 게시 시작일/종료일을 지정하고, `/display`는 현재 기간 내 공지만 표시한다.

**Architecture:** `notices` 엔티티에 `startDate`(number, ms), `endDate`(number | null) 필드 추가. Admin 폼에 date input 2개 추가. Display 쿼리 결과를 클라이언트에서 기간 필터링. 기존 공지는 `startDate` 미설정 시 `createdAt` 폴백, `endDate` 미설정 시 무기한 취급.

**Tech Stack:** InstantDB schema, React date inputs, TypeScript

---

### Task 1: 스키마에 startDate / endDate 필드 추가

**Files:**
- Modify: `instant.schema.ts:9-13`

- [ ] **Step 1: `notices` 엔티티에 필드 추가**

`instant.schema.ts`에서 notices 엔티티를 수정:

```ts
notices: i.entity({
  title: i.string(),
  content: i.string(),
  professor: i.string(),
  category: i.string(),
  createdAt: i.number().indexed(),
  startDate: i.number().optional(),
  endDate: i.number().optional(),
}),
```

`startDate`와 `endDate` 모두 `optional()`로 선언 — 기존 공지에는 이 필드가 없으므로.

- [ ] **Step 2: 스키마 push**

Run: `npx instant-cli push schema`
Expected: 스키마가 InstantDB에 반영됨

- [ ] **Step 3: Commit**

```bash
git add instant.schema.ts
git commit -m "feat: add startDate/endDate fields to notices schema"
```

---

### Task 2: 기간 필터 유틸 함수 작성

**Files:**
- Modify: `src/lib/categories.ts`

- [ ] **Step 1: `isNoticeVisible` 헬퍼 추가**

`src/lib/categories.ts` 파일 하단에 추가:

```ts
/**
 * 공지가 현재 게시 기간 내인지 판별.
 * - startDate 없으면 createdAt 사용
 * - endDate 없으면 무기한
 * - endDate는 해당 날짜의 끝(23:59:59)까지 포함
 */
export function isNoticeVisible(
  notice: { createdAt: number; startDate?: number; endDate?: number },
  now: number = Date.now(),
): boolean {
  const start = notice.startDate ?? notice.createdAt;
  if (now < start) return false;
  if (notice.endDate == null) return true;
  return now <= notice.endDate;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/categories.ts
git commit -m "feat: add isNoticeVisible helper for schedule filtering"
```

---

### Task 3: Admin 폼에 게시 기간 입력 추가

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: FormState에 startDate / endDate 추가**

`src/app/admin/page.tsx`에서 `FormState` 인터페이스와 `EMPTY_FORM` 수정:

```ts
interface FormState {
  id: string | null;
  title: string;
  content: string;
  category: Category;
  startDate: string; // "YYYY-MM-DD" for input[type=date]
  endDate: string;   // "" means 무기한
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  content: "",
  category: "일반",
  startDate: new Date().toISOString().slice(0, 10), // 오늘
  endDate: "",
};
```

- [ ] **Step 2: ms ↔ date string 변환 헬퍼 추가**

같은 파일 상단(Dashboard 함수 위)에 추가:

```ts
/** "YYYY-MM-DD" → 해당 날짜 0시 0분의 ms timestamp */
function dateToMs(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getTime();
}

/** ms timestamp → "YYYY-MM-DD" */
function msToDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
```

- [ ] **Step 3: startEdit에서 날짜 필드 채우기**

`startEdit` 함수 수정:

```ts
function startEdit(n: Notice) {
  setForm({
    id: n.id,
    title: n.title,
    content: n.content,
    category: asCategory(n.category),
    startDate: n.startDate ? msToDate(n.startDate) : msToDate(n.createdAt),
    endDate: n.endDate ? msToDate(n.endDate) : "",
  });
}
```

- [ ] **Step 4: handleSubmit에서 날짜 필드 저장**

`handleSubmit` 함수의 transact 호출에 날짜 필드 추가. 새 공지 생성 부분:

```ts
await db.transact(
  db.tx.notices[id()].update({
    title: form.title.trim(),
    content: form.content.trim(),
    professor: adminLabel,
    category: form.category,
    createdAt: Date.now(),
    startDate: dateToMs(form.startDate),
    endDate: form.endDate ? dateToMs(form.endDate) : null,
  }),
);
```

수정 부분도 동일하게 `startDate`, `endDate` 추가:

```ts
await db.transact(
  db.tx.notices[form.id].update({
    title: form.title.trim(),
    content: form.content.trim(),
    professor: adminLabel,
    category: form.category,
    startDate: dateToMs(form.startDate),
    endDate: form.endDate ? dateToMs(form.endDate) : null,
  }),
);
```

- [ ] **Step 5: 폼 UI에 date input 추가**

`src/app/admin/page.tsx`의 폼에서, "내용" `<Field>` 와 submit 버튼 사이에 게시 기간 필드 추가:

```tsx
<Field label="게시 기간">
  <div className="flex items-center gap-2">
    <input
      type="date"
      value={form.startDate}
      onChange={(e) =>
        setForm((f) => ({ ...f, startDate: e.target.value }))
      }
      className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
    />
    <span className="text-xs text-zinc-500">~</span>
    <input
      type="date"
      value={form.endDate}
      onChange={(e) =>
        setForm((f) => ({ ...f, endDate: e.target.value }))
      }
      placeholder="무기한"
      className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
    />
  </div>
  {!form.endDate && (
    <p className="mt-1 text-[11px] text-zinc-500">
      종료일을 비우면 무기한 게시됩니다.
    </p>
  )}
</Field>
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add start/end date inputs to admin notice form"
```

---

### Task 4: Admin 공지 리스트에 게시 기간 표시

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: NoticeRow에 게시 기간 표시 추가**

`NoticeRow` 컴포넌트에서 기존 `formatAbsolute(notice.createdAt)` 옆에 게시 기간 정보 추가. 날짜 라인을 수정:

```tsx
<span className="text-[11px] text-zinc-500">
  {formatAbsolute(notice.createdAt)}
  {" · "}
  {notice.startDate ? msToDate(notice.startDate) : msToDate(notice.createdAt)}
  {" ~ "}
  {notice.endDate ? msToDate(notice.endDate) : "무기한"}
</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: show schedule dates in admin notice list"
```

---

### Task 5: Display 페이지에서 기간 필터 적용

**Files:**
- Modify: `src/app/display/page.tsx`

- [ ] **Step 1: isNoticeVisible import 추가**

`src/app/display/page.tsx` 상단 import에 추가:

```ts
import {
  CATEGORY_STYLES,
  formatAbsolute,
  formatRelative,
  isNoticeVisible,
} from "@/lib/categories";
```

- [ ] **Step 2: 공지 목록 필터링**

`DisplayPage` 컴포넌트에서 notices 가공 부분 수정:

```ts
const allNotices = data.notices ?? [];
const notices = allNotices.filter((n) => isNoticeVisible(n, now));
const urgent = notices.filter((n) => asCategory(n.category) === "긴급");
const others = notices.filter((n) => asCategory(n.category) !== "긴급");
```

기존 `const notices = data.notices ?? [];` 라인을 위 3줄로 교체.

- [ ] **Step 3: Commit**

```bash
git add src/app/display/page.tsx
git commit -m "feat: filter display notices by schedule date range"
```

---

### Task 6: 수동 검증

- [ ] **Step 1: dev 서버 실행**

Run: `npm run dev`

- [ ] **Step 2: Admin에서 게시 기간 테스트**

1. `/admin`에서 새 공지 작성 — 시작일 오늘, 종료일 내일로 설정 → 등록
2. `/admin`에서 새 공지 작성 — 시작일 내일, 종료일 비움 → 등록 (아직 display에 안 보여야 함)
3. `/admin`에서 새 공지 작성 — 시작일 어제, 종료일 어제로 설정 → 등록 (display에 안 보여야 함)

- [ ] **Step 3: Display에서 필터 확인**

1. `/display` 열기
2. 1번 공지만 보이는지 확인
3. 2번(미래 시작), 3번(기간 만료) 공지는 안 보이는지 확인

- [ ] **Step 4: 기존 공지 호환성 확인**

기존에 startDate/endDate 없이 만든 공지가 여전히 display에 보이는지 확인 (createdAt 폴백)

- [ ] **Step 5: Commit (스키마 push 완료 후 최종)**

```bash
git add -A
git commit -m "feat: notice schedule - complete implementation"
```
