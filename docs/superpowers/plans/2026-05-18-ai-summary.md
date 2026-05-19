# AI 요약 기능 (Ollama Cloud) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin 저장 시 Ollama Cloud(qwen3.5:9b)로 본문을 요약하고 `notices.summary` 에 저장하여, widget 자세히보기에서 제목과 본문 사이 박스로 노출한다.

**Architecture:** Next.js 16 App Router. 클라이언트(admin)는 신규 API Route `/api/summarize` 에 본문을 보내 요약을 받은 뒤, 기존 패턴 그대로 `db.transact()` 로 InstantDB 에 한 번에 쓴다. API Route 만 서버 사이드에서 Ollama Cloud 토큰을 사용. widget 은 `summary` 가 있을 때만 박스를 조건부 렌더한다.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind v4 / InstantDB (`@instantdb/react`) / framer-motion / Ollama Cloud (`https://ollama.com/api/chat`)

**Spec:** [`docs/superpowers/specs/2026-05-18-ai-summary-design.md`](../specs/2026-05-18-ai-summary-design.md)

---

## File Map

| 경로 | 동작 | 책임 |
|---|---|---|
| `instant.schema.ts` | modify | `notices.summary` 옵셔널 필드 추가 |
| `src/lib/ai-summary.ts` | **create** | 시스템 프롬프트 상수 + 클라이언트 헬퍼 |
| `src/app/api/summarize/route.ts` | **create** (디렉토리도 새로 생성) | POST 핸들러. Ollama Cloud 호출. 사전 가드(짧은 본문/긴 본문/키 미설정) |
| `src/app/admin/page.tsx` | modify | `FormState` 에 `originalContent`/`originalSummary` 추가, `EMPTY_FORM`/`startEdit`/`handleSubmit` 갱신 |
| `src/app/widget/page.tsx` | modify | `NoticeDetailOverlay` 의 제목과 본문 사이에 summary 박스 조건부 렌더 |
| `.env.example` | **create** | `OLLAMA_API_KEY`, `OLLAMA_MODEL` 더미 + 기존 변수도 같이 명시 |

---

## Test strategy (특이사항)

이 프로젝트는 단위 테스트 프레임워크가 설치돼 있지 않다(`package.json` 의 `scripts` / `devDependencies` 어느 쪽에도 없음). CLAUDE.md 의 외부 의존성 통제 룰로 인해 임의로 vitest/jest 를 추가할 수 없다. 따라서 각 task 의 검증은 다음으로 갈음한다:

- **타입체크**: `npx tsc --noEmit`
- **빌드**: `npm run build` (마지막 task 에서 한 번)
- **수동 검증**: dev 서버를 띄우고 admin → DB → widget 흐름을 직접 확인. 각 task 의 마지막 단계에서 명시.

이는 TDD 원칙의 변형(타입·빌드·수동 사이클)으로, "코드 작성 → 검증 명령 실행 → 통과 확인 → 커밋" 의 짧은 루프를 유지한다.

---

## Task 1: 스키마 변경 — `notices.summary` 옵셔널 필드

**Files:**
- Modify: `instant.schema.ts` (전체 7~28줄)

- [ ] **Step 1: `instant.schema.ts` 의 `notices` 엔티티에 `summary` 필드 추가**

기존 (`instant.schema.ts:9-19`):
```ts
notices: i.entity({
  title: i.string(),
  content: i.string(),
  professor: i.string().optional(),
  category: i.string(), // '' | '1학년' | '2학년' | '3학년' | '4학년'
  createdAt: i.number().indexed(),
  link: i.string().optional(),
  startDate: i.number().optional(),
  endDate: i.number().optional(),
  checkCount: i.number().optional(),
}),
```

다음으로 교체:
```ts
notices: i.entity({
  title: i.string(),
  content: i.string(),
  professor: i.string().optional(),
  category: i.string(), // '' | '1학년' | '2학년' | '3학년' | '4학년'
  createdAt: i.number().indexed(),
  link: i.string().optional(),
  startDate: i.number().optional(),
  endDate: i.number().optional(),
  checkCount: i.number().optional(),
  summary: i.string().optional(), // AI 요약. admin 저장 시 자동 생성, widget 자세히보기에서 노출.
}),
```

- [ ] **Step 2: 타입체크로 컴파일 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. `src/lib/instant.ts` 의 `Notice` 타입은 `InstaQLEntity<AppSchema, "notices">` 로 추론되므로 자동으로 `summary?: string` 이 포함된다.

- [ ] **Step 3: InstantDB 에 스키마 push**

Run: `npx instant-cli push schema`
Expected: "Schema pushed" 류 성공 메시지. 실패 시 (예: `INSTANT_APP_ADMIN_TOKEN` 미설정) 사용자에게 보고하고 멈춤.

> 주의: 이 명령은 원격 DB 에 영향을 준다. 실행 전 `.env.local` 의 InstantDB 자격증명이 dev 앱을 가리키는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add instant.schema.ts
git commit -m "$(cat <<'EOF'
[ADD] notices 엔티티에 summary 옵셔널 필드 추가

AI 요약 기능 도입 준비. 옵셔널이라 기존 공지는 그대로 두고,
Ollama 호출 실패 시에도 summary 없이 저장 가능.
EOF
)"
```

---

## Task 2: `.env.example` 생성

**Files:**
- Create: `.env.example`

- [ ] **Step 1: 프로젝트 루트의 기존 변수 확인**

Run: `grep -E '^(NEXT_PUBLIC_|OLLAMA_)' /Users/nyxrux62/Documents/GitHub/epl-s1/.env.local 2>/dev/null || echo "no .env.local"`

이 결과로 기존 변수 이름을 알 수 있다. README.md 에 따르면 최소한 `NEXT_PUBLIC_INSTANT_APP_ID`, `NEXT_PUBLIC_ADMIN_PASSWORD` 가 있어야 한다.

- [ ] **Step 2: `.env.example` 작성**

Create `.env.example` with:
```
# InstantDB 앱 ID — instantdb.com/dash 에서 발급
NEXT_PUBLIC_INSTANT_APP_ID=

# admin 페이지 비밀번호 (클라이언트 번들에 포함됨 — 학내망 전용 가정)
NEXT_PUBLIC_ADMIN_PASSWORD=

# Ollama Cloud API 키 — ollama.com 에서 발급. 서버 사이드 전용.
# NEXT_PUBLIC_ 접두사 절대 사용 금지 (클라이언트 노출됨).
OLLAMA_API_KEY=

# 요약에 사용할 Ollama Cloud 모델. 기본값 qwen3.5:9b.
OLLAMA_MODEL=qwen3.5:9b
```

- [ ] **Step 3: 커밋**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
[ADD] .env.example 작성

InstantDB / admin 비밀번호 / Ollama Cloud 환경변수의 더미 값.
OLLAMA_API_KEY 는 서버 사이드 전용 (NEXT_PUBLIC_ 금지).
EOF
)"
```

---

## Task 3: 시스템 프롬프트 + 클라이언트 헬퍼 (`src/lib/ai-summary.ts`)

**Files:**
- Create: `src/lib/ai-summary.ts`

- [ ] **Step 1: 파일 작성**

Create `src/lib/ai-summary.ts` with:
```ts
/**
 * AI 요약 관련 상수 / 클라이언트 헬퍼.
 * - 서버 사이드(API Route) 는 SUMMARY_SYSTEM_PROMPT 만 import.
 * - 클라이언트(admin) 는 requestSummary 만 import.
 */

export const SUMMARY_SYSTEM_PROMPT = `당신은 학내 공지 요약 도우미입니다.
주어진 공지를 학생이 빠르게 파악할 수 있도록 한국어로 요약하세요.

규칙:
- 2~3문장, 총 100자 내외
- 핵심 정보(날짜·장소·대상·제출처)는 절대 빠뜨리지 말 것
- 본문에 없는 정보를 만들어내지 말 것
- "요약하면", "이 공지는" 같은 메타 표현 금지
- 평서체로 작성

출력은 요약문만. 다른 텍스트 없이.`;

/** 호출 자체를 건너뛰는 본문 길이 임계값 (이하면 호출 안 함). */
export const MIN_CONTENT_LENGTH = 30;
/** 본문이 이 길이를 넘으면 앞부분만 잘라서 보냄 (토큰 한도 보호). */
export const MAX_CONTENT_LENGTH = 8000;
/** Ollama 호출 타임아웃 (ms). */
export const OLLAMA_TIMEOUT_MS = 10_000;

/**
 * /api/summarize 호출. admin 클라이언트가 사용.
 * 실패해도 throw 하지 않고 null 반환 — admin 저장 흐름이 막히지 않도록.
 */
export async function requestSummary(
  title: string,
  content: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { summary: string | null };
    return json.summary ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/ai-summary.ts
git commit -m "$(cat <<'EOF'
[ADD] AI 요약 시스템 프롬프트 + 클라이언트 헬퍼

서버용 SUMMARY_SYSTEM_PROMPT 와 클라이언트용 requestSummary 를
한 모듈에 두되, 각자 자기 쪽만 import 한다.
requestSummary 는 실패 시 null 반환 (저장 흐름이 막히지 않게).
EOF
)"
```

---

## Task 4: API Route — `/api/summarize`

**Files:**
- Create: `src/app/api/summarize/route.ts` (디렉토리도 신규)

- [ ] **Step 1: 디렉토리 + 파일 생성**

Create `src/app/api/summarize/route.ts` with:
```ts
import { NextResponse } from "next/server";
import {
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  OLLAMA_TIMEOUT_MS,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/ai-summary";

/**
 * POST /api/summarize
 *
 * Body: { title: string, content: string }
 * Response:
 *   200 { summary: string | null }   — 정상. summary=null 은 본문이 너무 짧아 호출 안 함.
 *   400 { error: "invalid_payload" } — title/content 누락
 *   503 { error: "ai_disabled" }     — OLLAMA_API_KEY 미설정
 *   502 { error: "upstream" }        — Ollama 5xx / 응답 파싱 실패
 *   504 { error: "timeout" }         — 10초 타임아웃
 */
export async function POST(req: Request) {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { title?: unknown }).title !== "string" ||
    typeof (body as { content?: unknown }).content !== "string"
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const title = (body as { title: string }).title.trim();
  const rawContent = (body as { content: string }).content;

  if (rawContent.trim().length < MIN_CONTENT_LENGTH) {
    return NextResponse.json({ summary: null }, { status: 200 });
  }

  const content =
    rawContent.length > MAX_CONTENT_LENGTH
      ? rawContent.slice(0, MAX_CONTENT_LENGTH)
      : rawContent;

  const model = process.env.OLLAMA_MODEL || "qwen3.5:9b";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const upstream = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: `제목: ${title}\n본문: ${content}` },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const data = (await upstream.json()) as {
      message?: { content?: unknown };
    };
    const text = data?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    return NextResponse.json({ summary: text.trim() }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. `@/lib/ai-summary` alias 가 tsconfig 의 `paths` 에서 동작하는지 확인. (기존 코드에서 동일 패턴 사용 중이므로 OK.)

- [ ] **Step 3: 수동 검증 — dev 서버 + curl**

Run: `npm run dev`

다른 터미널에서:
```bash
# 정상 케이스 (본문 30자 이상)
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트","content":"내일 14시 102호에서 데이터구조 보강 수업이 있습니다. 2학년 대상이며 출석은 자율입니다."}'
# Expected: 200 { "summary": "..." }

# 짧은 본문 (30자 미만) → summary null
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"title":"x","content":"짧음"}'
# Expected: 200 { "summary": null }

# 잘못된 페이로드
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"foo":1}'
# Expected: 400 { "error": "invalid_payload" }
```

dev 서버는 그대로 두고 다음 task 로 진행 (admin/widget 작업 시 재사용).

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/summarize/route.ts
git commit -m "$(cat <<'EOF'
[ADD] /api/summarize Route Handler

Ollama Cloud(qwen3.5:9b) 로 공지를 요약하는 서버 사이드 엔드포인트.
키 미설정/짧은 본문/타임아웃/upstream 5xx 각각의 에러를 명시적 status 로 분리.
긴 본문은 8000자로 자른다.
EOF
)"
```

---

## Task 5: admin 통합 — 저장 시 요약 fetch

**Files:**
- Modify: `src/app/admin/page.tsx` (Line 126~208 영역)

- [ ] **Step 1: `requestSummary` import 추가**

`src/app/admin/page.tsx` 의 기존 import 블록 (Line 1-19) 끝, `from "@/lib/categories"` 다음 줄에 추가:

```ts
import { requestSummary } from "@/lib/ai-summary";
```

- [ ] **Step 2: `FormState` 에 두 필드 추가 (Line 126-134)**

기존:
```ts
interface FormState {
  id: string | null; // null 이면 새 공지
  title: string;
  content: string;
  category: string; // 쉼표 구분 다중 카테고리 (e.g. "1학년,3학년")
  link: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "" means 무기한
}
```

다음으로 교체:
```ts
interface FormState {
  id: string | null; // null 이면 새 공지
  title: string;
  content: string;
  category: string; // 쉼표 구분 다중 카테고리 (e.g. "1학년,3학년")
  link: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "" means 무기한
  /** edit 모드 진입 시점의 content. 저장 시 비교해서 변경 없으면 요약 재사용. 새 공지는 빈 문자열. */
  originalContent: string;
  /** edit 모드 진입 시점의 summary. content 가 그대로면 이 값을 그대로 transact 에 포함. */
  originalSummary: string | null;
}
```

- [ ] **Step 3: `EMPTY_FORM` 에 두 필드 추가 (Line 136-144)**

기존:
```ts
const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  content: "",
  category: "",
  link: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};
```

다음으로 교체:
```ts
const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  content: "",
  category: "",
  link: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  originalContent: "",
  originalSummary: null,
};
```

- [ ] **Step 4: `startEdit` 에서 original 두 필드 채우기 (Line 157-167)**

기존:
```ts
function startEdit(n: Notice) {
  setForm({
    id: n.id,
    title: n.title,
    content: n.content,
    category: n.category ?? "",
    link: n.link ?? "",
    startDate: n.startDate ? msToDate(n.startDate) : msToDate(n.createdAt),
    endDate: n.endDate ? msToDate(n.endDate) : "",
  });
}
```

다음으로 교체:
```ts
function startEdit(n: Notice) {
  setForm({
    id: n.id,
    title: n.title,
    content: n.content,
    category: n.category ?? "",
    link: n.link ?? "",
    startDate: n.startDate ? msToDate(n.startDate) : msToDate(n.createdAt),
    endDate: n.endDate ? msToDate(n.endDate) : "",
    originalContent: n.content,
    originalSummary: (n as Notice & { summary?: string | null }).summary ?? null,
  });
}
```

- [ ] **Step 5: `handleSubmit` 에 요약 fetch 끼우기 (Line 173-208)**

기존:
```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!form.title.trim() || !form.content.trim()) {
    return;
  }
  setSubmitting(true);
  try {
    if (editing && form.id) {
      await db.transact(
        db.tx.notices[form.id].update({
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category || "",
          link: form.link.trim() || null,
          startDate: dateToMs(form.startDate),
          endDate: form.endDate ? dateToMs(form.endDate) : null,
        }),
      );
    } else {
      await db.transact(
        db.tx.notices[id()].update({
          title: form.title.trim(),
          content: form.content.trim(),
          category: form.category || "",
          link: form.link.trim() || null,
          createdAt: Date.now(),
          startDate: dateToMs(form.startDate),
          endDate: form.endDate ? dateToMs(form.endDate) : null,
        }),
      );
    }
    reset();
  } finally {
    setSubmitting(false);
  }
}
```

다음으로 교체:
```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const trimmedTitle = form.title.trim();
  const trimmedContent = form.content.trim();
  if (!trimmedTitle || !trimmedContent) {
    return;
  }
  setSubmitting(true);
  try {
    // 본문이 그대로면 기존 summary 재사용 — 토큰 낭비 방지.
    const contentUnchanged =
      editing && trimmedContent === form.originalContent.trim();
    let summary: string | null;
    if (contentUnchanged) {
      summary = form.originalSummary;
    } else {
      summary = await requestSummary(trimmedTitle, trimmedContent);
    }

    if (editing && form.id) {
      await db.transact(
        db.tx.notices[form.id].update({
          title: trimmedTitle,
          content: trimmedContent,
          category: form.category || "",
          link: form.link.trim() || null,
          startDate: dateToMs(form.startDate),
          endDate: form.endDate ? dateToMs(form.endDate) : null,
          // null 로 명시해서 기존 summary 가 있었어도 비우는 경우(요약 실패)는 그대로 비움.
          summary: summary,
        }),
      );
    } else {
      await db.transact(
        db.tx.notices[id()].update({
          title: trimmedTitle,
          content: trimmedContent,
          category: form.category || "",
          link: form.link.trim() || null,
          createdAt: Date.now(),
          startDate: dateToMs(form.startDate),
          endDate: form.endDate ? dateToMs(form.endDate) : null,
          summary: summary,
        }),
      );
    }
    reset();
  } finally {
    setSubmitting(false);
  }
}
```

> 토스트는 이 프로젝트에 별도 라이브러리/시스템이 없으므로(검색 결과 없음) 이번 스코프에서는 토스트를 추가하지 않는다. 저장 버튼이 "저장 중…" 으로 바뀌는 기존 UX 가 진행 표시 역할을 한다. 실패 시 사용자에게 별도 알림은 없지만, 공지는 정상 저장되고 summary 만 null 로 들어간다 (위젯 박스가 단순히 안 보임). 추후 토스트 시스템 도입 시 보강.

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. 만약 schema push 가 아직 안 된 상태라면 `summary` 가 알려지지 않을 수 있음 — InstantDB CLI 가 `instant.schema.ts` 를 기반으로 클라이언트 타입을 추론하므로 schema 파일이 이미 갱신돼 있으면 OK.

- [ ] **Step 7: 수동 검증 — admin 저장 흐름**

dev 서버가 안 켜져 있다면 `npm run dev`.

1. 브라우저로 `http://localhost:3000/admin` 접속, 비밀번호 `epls1` 입력.
2. 새 공지 작성:
   - 제목: `테스트 요약 1`
   - 내용: `내일 오후 2시에 102호에서 데이터구조 보강 수업이 있습니다. 2학년 대상이며 출석은 자율입니다. 질문은 슬랙으로 받습니다.`
   - 카테고리: 2학년
3. "공지 등록" 클릭. 1~2초 뒤 폼이 리셋되면 성공.
4. InstantDB 대시보드 또는 다음 task 의 widget 검증에서 `summary` 필드가 채워졌는지 확인.
5. **수정 케이스 검증**: 등록된 공지의 "수정" 버튼 클릭 → 본문 그대로 두고 "변경사항 저장" → 즉시 저장됨 (요약 fetch 없이 1초 미만). 본문을 한 글자 바꾸고 저장 → 다시 1~2초 대기 후 저장.
6. **짧은 본문 검증**: 본문에 `짧음` 만 적고 등록 → 정상 등록, summary 는 null.

- [ ] **Step 8: 커밋**

```bash
git add src/app/admin/page.tsx
git commit -m "$(cat <<'EOF'
[UPDATE] admin 저장 시 AI 요약 자동 생성

저장 버튼 누를 때 /api/summarize 로 본문을 보내 요약을 받고,
기존 db.transact 호출에 summary 를 같이 실어 한 번에 저장.
수정 시 본문 변경 없으면 기존 summary 를 재사용해 토큰 절약.
교수 입장에서는 "저장 중…" 라벨이 잠깐 보일 뿐 AI 의 존재를 의식할 필요 없음.
EOF
)"
```

---

## Task 6: widget 자세히보기에 summary 박스 추가

**Files:**
- Modify: `src/app/widget/page.tsx` (Line 18 import, Line 706-850 영역)

- [ ] **Step 1: `CATEGORY_STYLES` / `parseCategories` / `DEFAULT_STYLE` import 확인**

`src/app/widget/page.tsx` 의 Line 18:
```ts
import { getEffectivePeriod, isNoticeVisible } from "@/lib/categories";
```

다음으로 교체:
```ts
import {
  CATEGORY_STYLES,
  DEFAULT_STYLE,
  getEffectivePeriod,
  isNoticeVisible,
  parseCategories,
} from "@/lib/categories";
```

- [ ] **Step 2: `NoticeDetailOverlay` 의 본문 영역 위에 summary 박스 삽입**

`src/app/widget/page.tsx` 의 Line 777-805 영역(제목 `<h2>` ~ 본문 `<div>` ) 안에서, 날짜 `<p>` (Line 788-793) 다음 줄, 본문 `<div className="flex-1 overflow-y-auto ...">` (Line 794) 바로 앞에 삽입.

찾을 위치는 다음 코드 패턴 직후 (Line 793 직후):
```tsx
        <p
          className="text-slate-400"
          style={{ fontSize: "2.6vh", marginBottom: "1.6vh" }}
        >
          {dateLabel}
        </p>
```

이 직후에 다음 블록 삽입:
```tsx
        <SummaryBox notice={notice} />
```

- [ ] **Step 3: `SummaryBox` 컴포넌트 추가**

파일 끝의 `/* ─── Empty / Error ─────────...` 섹션 바로 앞 (Line 852 직전), 즉 `NoticeDetailOverlay` 클로징 `}` 다음 빈 줄 뒤에 새 섹션으로 추가:

```tsx
/* ─── Summary Box ───────────────────────────────────── */

function SummaryBox({ notice }: { notice: Notice }) {
  const summary = (notice as Notice & { summary?: string | null }).summary;
  if (!summary || summary.trim().length === 0) return null;

  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;

  return (
    <div
      className="text-slate-100"
      style={{
        background: "rgba(255,255,255,0.05)",
        borderLeft: `0.5vh solid ${style.color}`,
        borderRadius: "1vh",
        padding: "1.6vh 2vh",
        marginBottom: "1.6vh",
        fontSize: "2.8vh",
        lineHeight: 1.5,
      }}
    >
      {summary}
    </div>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증 — widget 자세히보기**

dev 서버가 안 켜져 있다면 `npm run dev`.

1. 브라우저로 `http://localhost:3000/widget` 접속.
2. Task 5 에서 등록한 "테스트 요약 1" 카드 클릭 → 자세히보기 오버레이 열림.
3. 제목과 본문 사이에 **연한 박스 + 왼쪽에 보라색(2학년=violet=#a78bfa) 보더** 가 있고, 그 안에 한국어 요약 2~3문장이 보이는지 확인.
4. **summary 없는 공지 검증**: Task 5 의 "짧음" 공지를 클릭 → summary 박스가 **렌더링되지 않음** (DOM 자체에 없음). 제목 바로 아래에 본문이 붙어 있어야 함.
5. **카테고리 컬러 검증**: 카테고리 1학년 공지 등록 후 보더가 cyan(#22d3ee) 인지, 카테고리 없는 공지는 보더가 회색(#64748b) 인지 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "$(cat <<'EOF'
[ADD] widget 자세히보기에 AI 요약 박스 표시

NoticeDetailOverlay 에서 제목 다음, 본문 위에 summary 박스를 조건부 렌더.
배경은 옅은 흰색 톤, 왼쪽 보더 컬러는 공지 카테고리 색.
summary 없는 공지는 박스 자체를 그리지 않는다.
EOF
)"
```

---

## Task 7: 최종 검증 + 위젯 버전 업

**Files:**
- Modify: `src/app/widget/page.tsx` (Line 35 `WIDGET_VERSION` 만)

- [ ] **Step 1: 위젯 버전 갱신**

`src/app/widget/page.tsx:35` 의 `WIDGET_VERSION` 상수를 한 단계 올린다. CLAUDE.md 의 버저닝 룰 (`YYYY.M.N` 같은 달 안에서 N 증가) 에 따라:

기존:
```ts
const WIDGET_VERSION = "V.2026.5.6";
```

다음으로 교체:
```ts
const WIDGET_VERSION = "V.2026.5.7";
```

(현재 날짜는 2026-05-19 이므로 동일 월. 직전 버전이 V.2026.5.6 이므로 V.2026.5.7.)

- [ ] **Step 2: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 전체 빌드**

Run: `npm run build`
Expected: 성공. `.next/` 산출물 생성. 경고는 무방하나 에러는 안 됨.

- [ ] **Step 4: 최종 통합 수동 검증**

dev 서버를 새로 띄움(`npm run dev`).

체크리스트:
- [ ] `/admin` 에서 본문 100자 이상 공지 등록 → 1~2초 대기 후 등록 완료
- [ ] `/widget` 에서 해당 카드 → 자세히보기 → summary 박스 정상 노출
- [ ] 본문 30자 미만 공지 등록 → 정상 등록 + 자세히보기에 summary 박스 부재
- [ ] 등록된 공지 수정 시 본문 그대로 두고 저장 → 즉시 저장 (요약 fetch 안 함, 1초 미만)
- [ ] 본문 변경하고 저장 → 다시 1~2초 대기 후 저장, summary 도 갱신
- [ ] `.env.local` 에서 `OLLAMA_API_KEY` 를 잠깐 비우고 admin 저장 → 공지 정상 등록 (summary 없이)
- [ ] `/display` 에 영향 없음 — 기존 그대로 동작

- [ ] **Step 5: 커밋**

```bash
git add src/app/widget/page.tsx
git commit -m "$(cat <<'EOF'
[CHORE] 위젯 버전 V.2026.5.7 로 갱신

AI 요약 박스 추가가 사용자에게 의미있는 변화이므로 위젯 버전 증가.
EOF
)"
```

- [ ] **Step 6: 최종 보고**

마지막 task 후 사용자에게 다음을 보고:
- 변경된 파일 목록 (`git log --stat -7..HEAD` 출력)
- 수동 검증 결과 (위 체크리스트 6개 항목)
- 다음 단계 옵션 제시:
  - `master` 머지 PR 생성 (`gh pr create`)
  - 추가 수동 테스트 후 진행
  - `npm run release` 로 위젯 배포까지

---

## Self-Review

### 1. Spec coverage

| Spec 섹션 | Task | 비고 |
|---|---|---|
| §2 범위 — 포함 4가지 | Task 1, 3, 4, 5, 6 | 모두 커버. display 노출은 의식적으로 제외. |
| §5 데이터 모델 (summary 필드) | Task 1 | schema + push. Notice 타입은 자동 추론. |
| §6 API Route | Task 4 | 전체 구현 + curl 검증. |
| §7 프롬프트 | Task 3 | `SUMMARY_SYSTEM_PROMPT` 상수로 분리. |
| §8 admin 통합 | Task 5 | FormState 확장 + handleSubmit 변경. 수정 시 비교 포함. |
| §9 widget 표시 | Task 6 | SummaryBox 컴포넌트, 카테고리 컬러 보더. |
| §10 환경변수 | Task 2 | `.env.example` 신규. |
| §11 에러/한계 정책 | Task 4 | 짧은 본문 / 긴 본문 / 키 미설정 / 타임아웃 모두 분기. |
| §14 테스트/검증 | Task 7 | 최종 통합 + 빌드. |

**갭**: spec §8.1 의 "토스트" 는 현재 프로젝트에 토스트 시스템이 없어 task 에서 의식적으로 제외했다. plan 본문에 명시. spec 자체엔 토스트가 있지만 구현 가능 여부 우선.

### 2. Placeholder scan

문서 내 "TBD", "TODO", "fill in", "similar to" 검색 결과 — 모두 실제 코드/명령으로 채워져 있다. 한 군데 (Task 5 Step 5의 토스트 누락 설명)는 placeholder 가 아니라 의식적 스코프 제외 사유.

### 3. Type consistency

- `requestSummary` 시그니처: `(title: string, content: string) => Promise<string | null>` — Task 3 정의 / Task 5 사용 일치.
- API Route 응답: `{ summary: string | null }` — Task 4 정의 / Task 3 의 `requestSummary` 가 동일하게 파싱.
- `FormState.originalSummary: string | null` — Task 5 Step 2 정의 / Step 4 (`startEdit`) 에서 `?? null` 폴백 / Step 5 (`handleSubmit`) 에서 `string | null` 그대로 사용.
- `Notice & { summary?: string | null }` 캐스팅이 admin/widget 양쪽에 등장 — 동일 형태 (이 캐스팅은 `instant-cli push schema` 가 적용되기 전 임시 보완. push 가 끝나면 `Notice` 가 자동으로 `summary?: string` 을 포함해서 캐스팅을 제거할 수도 있지만, 안전을 위해 명시 유지).

이슈 없음.
