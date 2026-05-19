# AI 요약 기능 설계 (Ollama Cloud)

- 작성일: 2026-05-18
- 작성자: jungminna03
- 상태: 검토 대기

## 1. 배경 / 목적

`/admin` 에서 등록되는 공지의 본문이 길어지는 경우, `/widget` 자세히보기 화면에서 학생이 한눈에 핵심을 파악하기 어렵다. AI 요약을 본문과 별도로 저장해두고, 위젯 자세히보기에서 본문 위에 별도 박스로 노출한다.

## 2. 범위

### 포함
- `notices` 엔티티에 `summary` 옵셔널 필드 추가
- admin 저장 시 서버 사이드에서 Ollama Cloud 를 호출해 `summary` 생성 (동기)
- widget 자세히보기 오버레이에 `summary` 박스 추가
- Ollama Cloud API Route (`/api/summarize`) 신설

### 제외 (이번 스코프 외)
- `/display` 사이니지에서의 요약 노출
- 카드 그리드(자세히보기 이전 단계)에서의 요약 노출
- 다국어 요약, 음성 합성, 길이 옵션 등 부가 기능
- 백그라운드 재시도 큐 / Cron 재요약
- admin 에서 요약을 보거나 직접 편집하는 UI

## 3. 의사결정 요약

| 항목 | 결정 | 이유 |
|---|---|---|
| 사용처 | admin 작성 시 자동 생성 → DB 저장 → widget 소비 | 1회 생성·N회 재사용. 일관성. |
| 트리거 | 저장 시 자동 (교수가 의식 안 함) | "사용자가 AI 요약을 신경쓰지 않게" 라는 요구 |
| 생성 시점 | 동기 (저장 → 요약 완료 → DB 저장) | summary 일관성 보장, 위젯 빈 박스 회피, 재시도 큐 불필요 |
| 모델 | `qwen3.5:9b` (Ollama Cloud) | 빠른 응답·한국어 OK·작은 모델 |
| 호출 위치 | Next.js API Route (서버) | API 키 클라이언트 노출 금지 |
| 실패 정책 | summary 없이 공지 정상 저장 + admin 토스트 | 요약은 부가 기능. 공지 등록 자체를 막지 않음 |
| display 노출 | 이번 스코프 제외 | 한 번에 하나씩 |

## 4. 아키텍처

```
admin /admin
  │ 교수가 제목+본문 입력 → "공지 등록" 클릭
  ▼
[클라이언트] POST /api/summarize { title, content }
  │ (서버 사이드)
  ▼
Next.js API Route
  │ OLLAMA_API_KEY 로 Ollama Cloud 호출
  │ https://ollama.com/api/chat
  ▼
응답에서 summary 추출
  ▼
[클라이언트] db.transact( notices ← { ..., summary? } )
  ▼
InstantDB → display / widget 자동 반영
```

**책임 분리**
- API Route: Ollama 호출만 책임. DB 는 건드리지 않는다.
- admin 클라이언트: 기존 InstantDB transact 로직 유지. 요약 fetch 만 끼워 넣는다.
- 이 분리의 이유: 기존 admin 저장 로직(권한 체크, 카테고리 기본값 등)을 그대로 살리고, AI 부분만 얇게 추가하기 위함.

## 5. 데이터 모델

### 5.1 스키마 변경 (`instant.schema.ts`)

```ts
notices: i.entity({
  title: i.string(),
  content: i.string(),
  professor: i.string().optional(),
  category: i.string(),
  createdAt: i.number().indexed(),
  link: i.string().optional(),
  startDate: i.number().optional(),
  endDate: i.number().optional(),
  checkCount: i.number().optional(),
  summary: i.string().optional(),   // ← 추가
}),
```

- 옵셔널 이유: ① 기존 공지엔 요약 없음(마이그레이션 부담 0). ② Ollama 실패 시 summary 없이 저장.
- 마이그레이션: `npx instant-cli push schema` 단발 실행.

### 5.2 타입 (`src/lib/instant.ts`)

`Notice` 타입에 `summary?: string` 추가. 그 외 변경 없음.

## 6. API Route

### 6.1 엔드포인트

```
POST /api/summarize
Content-Type: application/json

Request:
{
  "title":   string,
  "content": string
}

Response (200):
{
  "summary": string | null
}

Response (4xx/5xx):
{
  "error": string
}
```

`summary: null` 케이스: 본문이 너무 짧아서 호출을 건너뛴 경우(6.4 참조). admin 은 200 + null 을 "요약 없이 저장" 으로 처리한다.

### 6.2 구현 위치

`src/app/api/summarize/route.ts` (Next.js 16 App Router Route Handler, `export async function POST`).

### 6.3 Ollama 호출

- URL: `https://ollama.com/api/chat`
- 헤더: `Authorization: Bearer ${process.env.OLLAMA_API_KEY}`
- 모델: `process.env.OLLAMA_MODEL` (기본 `qwen3.5:9b`)
- 타임아웃: 10초 (`AbortController`)
- Body:
  ```json
  {
    "model": "<env>",
    "messages": [
      { "role": "system", "content": "<SUMMARY_SYSTEM_PROMPT>" },
      { "role": "user",   "content": "제목: <title>\n본문: <content>" }
    ],
    "stream": false
  }
  ```
- 응답 처리: `response.message.content` 만 추출, `trim()`. 그 외 필드 무시.

### 6.4 사전 가드 (호출 전)

| 조건 | 처리 |
|---|---|
| 본문(`content`)이 30자 미만 | 호출 건너뛰고 `200 { summary: null }` 반환. 토큰 낭비 방지 |
| 본문 10,000자 초과 | 앞 8,000자로 잘라서 호출 (토큰 한도 보호) |
| `OLLAMA_API_KEY` 미설정 | `503 { error: "ai_disabled" }` |
| `title`/`content` 누락 | `400 { error: "invalid_payload" }` |

## 7. 프롬프트

`src/lib/ai-summary.ts` (신규)에 상수로 분리:

```ts
export const SUMMARY_SYSTEM_PROMPT = `
당신은 학내 공지 요약 도우미입니다.
주어진 공지를 학생이 빠르게 파악할 수 있도록 한국어로 요약하세요.

규칙:
- 2~3문장, 총 100자 내외
- 핵심 정보(날짜·장소·대상·제출처)는 절대 빠뜨리지 말 것
- 본문에 없는 정보를 만들어내지 말 것
- "요약하면", "이 공지는" 같은 메타 표현 금지
- 평서체로 작성

출력은 요약문만. 다른 텍스트 없이.
`.trim();
```

분리 이유: 추후 튜닝 시 API Route 코드를 건드리지 않게.

## 8. admin 통합 (`src/app/admin/page.tsx`)

### 8.1 저장 흐름

```
저장 클릭
  ├─ 버튼: "저장 중..." + disabled
  ├─ fetch('/api/summarize', { title, content })
  │    ├─ ok   → summary = resp.summary (null 허용)
  │    └─ fail → summary = undefined (catch + 타임아웃)
  ├─ db.transact( notices ← { ...필드, summary? } )
  └─ 토스트
       ├─ summary 있음: "공지 등록 완료"
       └─ summary 없음: "공지 등록 완료 (요약 생략)"
```

- "AI" 라는 단어는 admin UI / 토스트 / 라벨 어디에도 노출하지 않는다(요구사항).
- "저장 중..." 라벨은 기존에 이미 있다면 재사용, 없다면 추가.

### 8.2 수정(edit) 케이스

- edit 모드 진입 시 admin form state 에 기존 `notice.summary` 와 기존 `notice.content`(이하 `originalContent`)를 함께 보관한다.
- 저장 시 비교:
  - 현재 `content === originalContent` → 요약 fetch 를 생략하고 기존 `summary` 를 그대로 `db.transact` 에 포함.
  - 그 외 → 동일한 흐름으로 재생성.
- 비교 기준: 양쪽 모두 `.trim()` 적용 후 strict equal (`===`).

## 9. widget 자세히보기 표시 (`src/app/widget/page.tsx`)

### 9.1 레이아웃

```
┌─────────────────────────────┐
│  제목                       │
├─────────────────────────────┤   ← summary 박스 (summary 있을 때만)
│  ┃  요약 텍스트             │
│  ┃                          │
├─────────────────────────────┤
│  본문                       │
└─────────────────────────────┘
```

- `summary` 가 falsy 이거나 빈 문자열이면 박스 자체를 렌더링하지 않는다 (DOM 부재).

### 9.2 스타일

- 컨테이너 배경: `bg-white/5` (다크 테마 기준 옅은 톤)
- 좌측 보더: 4px, 카테고리 컬러(1학년=cyan, 2학년=violet, 3학년=emerald, 4학년=orange). 카테고리가 없으면 중립 회색.
  - 컬러는 `src/lib/categories.ts` 의 기존 매핑 재사용.
- 패딩 / 모서리 / 폰트 크기는 기존 본문 컴포넌트의 토큰을 따른다.
- "AI 요약" 같은 라벨은 표시하지 않는다 (사용자가 AI 를 의식하지 않게).

### 9.3 다른 화면

- `/display` 와 카드 그리드(자세히보기 이전 단계)는 `summary` 를 사용하지 않는다.
- 향후 필요 시 같은 박스를 컴포넌트화해 재사용 (이번 스코프 외).

## 10. 환경변수

`.env.local` / `.env.example`:

```
OLLAMA_API_KEY=          # 서버 사이드 전용. NEXT_PUBLIC_ 접두사 금지.
OLLAMA_MODEL=qwen3.5:9b  # 기본값. 환경별로 교체 가능.
```

- `.env.example` 에는 더미 값으로 추가해 팀원이 알 수 있게.
- `OLLAMA_API_KEY` 는 절대 클라이언트 번들에 포함되면 안 된다 (`NEXT_PUBLIC_` 사용 금지).
- 키 노출이 의심되면 즉시 ollama.com 에서 회전.

## 11. 에러 / 한계 정책

| 상황 | API Route | admin |
|---|---|---|
| Ollama 5xx / 네트워크 실패 | `502 { error: "upstream" }` | summary 없이 저장, 토스트 "요약 생략" |
| 10초 타임아웃 | `504 { error: "timeout" }` | 동일 |
| `OLLAMA_API_KEY` 미설정 | `503 { error: "ai_disabled" }` | 동일 |
| 본문 30자 미만 | `200 { summary: null }` | 토스트 별도 표시 없음(정상 케이스) |
| 본문 10,000자 초과 | 앞 8,000자로 잘라 호출, `200 { summary: ... }` | 정상 |
| 응답이 비정상적으로 김(200자 초과) | 그대로 반환 | 위젯 측 CSS `line-clamp` 로 안전망 |
| `title`/`content` 누락 | `400 { error: "invalid_payload" }` | 토스트 "요약 요청 실패" (이 경우는 클라 버그) |

## 12. 영향 받는 파일

| 파일 | 변경 |
|---|---|
| `instant.schema.ts` | `notices.summary` 옵셔널 추가 |
| `src/lib/instant.ts` | `Notice` 타입 갱신 |
| `src/lib/ai-summary.ts` | 신규: 시스템 프롬프트 상수 |
| `src/app/api/summarize/route.ts` | 신규: Ollama Cloud 호출 |
| `src/app/admin/page.tsx` | 저장 핸들러에 요약 fetch 끼우기 |
| `src/app/widget/page.tsx` | 상세 오버레이 summary 박스 |
| `.env.example` | `OLLAMA_API_KEY`, `OLLAMA_MODEL` 더미 |

## 13. 보안 고려사항

- `OLLAMA_API_KEY` 는 서버 사이드 환경변수로만 접근. 클라이언트 번들 / 응답 본문 / 로그 어디에도 노출하지 않는다.
- API Route 자체는 인증 게이트 없이 동작한다(현 admin 도 `NEXT_PUBLIC_ADMIN_PASSWORD` 로 sessionStorage 게이트). 학내망 가정.
- 단, 누구나 `/api/summarize` 를 호출해 토큰을 소모시킬 위험이 있다 → 다음 후속 작업 후보로 분리:
  - 후속: admin 세션 토큰을 헤더로 받아 검증, 또는 IP/레이트 리밋. 이번 스코프엔 포함하지 않음.

## 14. 테스트 / 검증

- 타입체크 `npx tsc --noEmit` 통과.
- 빌드 `npm run build` 통과.
- 수동 검증:
  - admin 에서 본문 100자 이상 공지 등록 → DB 에 summary 들어감 → widget 자세히보기에 박스 표시.
  - admin 에서 본문 30자 미만 공지 등록 → DB summary 없음 → widget 박스 없음.
  - `OLLAMA_API_KEY` 를 빈 값으로 두고 admin 저장 → 공지 정상 등록 + "요약 생략" 토스트.
  - admin 에서 기존 공지 수정 시 본문 그대로 → summary 유지. 본문 변경 → summary 재생성.
  - widget 자세히보기에서 카테고리별 보더 컬러 확인.

## 15. 향후 작업 (out of scope)

- `/display` 사이니지에서의 summary 노출
- 카드 그리드에서 summary 노출 (자세히보기 이전 단계)
- 백그라운드 재요약 (Ollama 일시 장애 후 자동 채우기)
- API Route 인증/레이트 리밋
- 한국어 외 언어 요약
- summary 직접 편집 UI
