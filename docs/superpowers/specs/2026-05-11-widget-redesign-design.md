# 위젯 리디자인 — Figma 기반 미니멀 카드 + 읽음 사이클

**작성일**: 2026-05-11
**Figma**: 단일 화면 (`node-id=1-3`) — 메인 리스트 화면만 존재. 나머지 상태는 본 spec 에서 합리적 기본값으로 확정.
**적용 범위**: `src/app/widget/page.tsx` 1개 파일 신규 작성 (현재 placeholder 교체).
**건드리지 않는 곳**: `/display`, `/admin`, `electron/*`, `src/lib/instant.ts`, `src/lib/categories.ts`, IPC 표면, 인스톨러, 자동 업데이트.

## 목적

데스크톱 위젯(`https://epl-s1.vercel.app/widget` 을 로드)을 화려한 사이니지 톤에서 **미니멀한 알림 위젯** 톤으로 리뉴얼한다. `/display` 는 그대로 유지하여 사이니지 PC 경험을 보존한다.

## 결정사항 요약

| 항목 | 선택 | 근거 |
|---|---|---|
| 적용 라우트 | `/widget` 단독 | 사용자 명시 — display 는 그대로. |
| 디자인 톤 | 다크 그레이 평면, 그라데이션·테두리 글로우 제거 | Figma 가 미니멀 톤. |
| 표시 항목 | 제목만 | 사용자 명시 — 본문/카테고리/시간/체크카운트 제거. |
| 카드 4 슬롯, 페이지 자동 회전 | 유지 (10초/페이지, 인디케이터 없음) | display 와 같은 데이터/회전. 인디케이터는 Figma 에 없어 제거. |
| 카드 클릭 | 외부 브라우저로 디스플레이 열기 | 사용자 명시 — 위젯에선 expand 동작 없음. |
| 제목 잘림 처리 | 좌측 슬라이드 마퀴 | 사용자 명시 — `...` truncate 대신. |
| 읽음 상태 | localStorage 기반 1시간 전역 사이클 | 익명 위젯이라 InstantDB 부적합. PC별 독립이 자연스러움. |
| 빨간 점 (카드) | 안 읽음 시 카드 우상단 | 사용자 명시. |
| 안 읽음 카운트 (위젯) | 좌하단 빨간 원 + 흰 숫자 | 사용자 명시. iOS 배지 스타일. |
| 카운트 산정 범위 | 전체 가시 공지 (필터 후 전체) | 페이지 회전 시 다른 페이지의 미열람도 신호화. |
| PinToggle | 유지 — 우상단 작게 | 위젯 핵심 기능. Figma 에 없지만 보존. |

## 레이아웃

```
┌─────────────────────────────────┐
│ v0.2.0          2026/05/11 (월)│  ← 좌: 버전, 우상단: 날짜(작게) + 시간(크게) + PinToggle
│ 📢 게임소프트웨어학과 공지 사항    02:50│
│                                 │
│ ┌─────────────────────────────┐•│  ● = 안 읽음 빨간 점 (카드 우상단)
│ │ 공지 사항 1                  │ │  카드 = 라운드, 약간 밝은 그레이
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 공지 사항 2                  │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐•│
│ │ 공지 사항 3 ←────────────── │ │  ← 긴 제목은 좌측 마퀴 슬라이드
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 공지 사항 4                  │ │
│ └─────────────────────────────┘ │
│                                 │
│ (5)                             │  ← 좌하단 빨간 원 + 안 읽음 수
└─────────────────────────────────┘
```

### 톤 & 치수 (모두 `vh` 단위 — 위젯 360×520 + display 양쪽 호환)

| 요소 | 색 | 크기 |
|---|---|---|
| 위젯 배경 | `#2a2d33` | 100vw × 100vh |
| 카드 배경 | `#4a4d55` | 카드별 `1fr` (4등분), 라운드 `1.8vh` |
| 카드 간격 | — | `1.2vh` |
| 외곽 패딩 | — | `1.5vh` |
| 제목 텍스트 | `#ffffff`, ExtraBold | `3.4vh` |
| 헤더 메가폰+학과명 | 흰색, 굵음 | `1.6vh` |
| 버전 라벨 | `#94a3b8` | `1vh` |
| 날짜 (작게) | `#94a3b8` | `1.3vh` |
| 시간 (크게) | 흰색, ExtraBold | `3.2vh` |
| 빨간 점 (카드) | `#ef4444` | 지름 `1.2vh`, 카드 우상단 안쪽 `0.8vh` |
| 안 읽음 배지 | 배경 `#ef4444`, 텍스트 흰색 굵음 | 지름 `2.6vh`, 좌하단 `1.5vh` 여백 |

## 컴포넌트 분리

`src/app/widget/page.tsx` 한 파일 안에 모두 둔다 (외부 share 없음, 위젯 전용):

```
WidgetPage (default export)
├── 데이터 fetch (db.useQuery)
├── now setInterval (30s — 시계 표시 + useReadState 의 리셋 체크 트리거)
├── 로딩/에러 분기
└── WidgetLayout
    ├── PinToggle
    ├── WidgetHeader (version, dept name, date, time)
    ├── NoticeGrid (4 슬롯, 페이지 회전, 빈 슬롯 대응)
    │   └── NoticeCard × 4
    │       ├── MarqueeText (제목)
    │       └── UnreadDot (우상단 빨간 점)
    └── UnreadBadge (좌하단 카운트)
```

별도 모듈:

- `src/lib/widget-read-state.ts` — localStorage 직렬화/역직렬화, 1시간 리셋 로직
  - `loadReadState(): { resetAt: number, readIds: Set<string> }`
  - `saveReadState(state)`
  - `maybeReset(state, now): state` — 1시간 경과 시 readIds 비움 + resetAt 갱신
  - `markRead(state, id): state` — 새 Set 반환 (immutable)

## 데이터 흐름

```
InstantDB (notices, createdAt desc)
  │
  ├─► isNoticeVisible 필터
  │     │
  │     ├─► pageNotices = visible.slice(pageIdx*4, pageIdx*4 + 4)
  │     │     └─► NoticeGrid 에 props
  │     │
  │     └─► visibleIds = visible.map(n => n.id)
  │           │
useReadState(visibleIds) ──► { readIds, unreadCount, markRead }
                                   │         │            │
                       NoticeCard ◄┘         │            │
                                 UnreadBadge ◄┘            │
                                          NoticeCard.onClick ─┘
```

## useReadState 훅 세부 동작

```ts
function useReadState(allNoticeIds: string[], now: number): {
  readIds: Set<string>;
  unreadCount: number;
  markRead: (id: string) => void;
};
```

- 마운트 시 `loadReadState()` 호출 → state 초기화
- `now` (위에서 30초마다 갱신되는 시계값) 가 바뀔 때마다 `maybeReset(state, now)` 적용
  - 별도 인터벌을 두지 않고 `WidgetPage` 의 `now` 흐름 하나에 묶음 → 시계와 리셋이 같은 박자
  - 30초 단위라 1시간 사이클의 정확도는 ±30초 — 충분
  - 리셋 발생 시 새 state 로 `setState` + `saveReadState` → 빨간 점/카운트 React 가 자동 갱신
- `markRead(id)`: 새 state 만들어 `saveReadState` + `setState`
- `unreadCount`: `allNoticeIds.filter(id => !readIds.has(id)).length`
- SSR 안전: `typeof window === "undefined"` 가드, 초기 렌더는 빈 Set

## 클릭 흐름

```ts
function openDisplay() {
  const origin = window.location.origin;  // dev: http://localhost:3000, prod: https://epl-s1.vercel.app
  const url = `${origin}/display`;
  const epl = (window as Window & { epl?: { openExternal: (u: string) => void } }).epl;
  if (epl?.openExternal) epl.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

// NoticeCard onClick:
markRead(notice.id);
openDisplay();
```

웹에서 `/widget` 을 직접 열어 테스트할 때도 fallback 으로 새 탭에서 `/display` 열림.

## MarqueeText 동작

- ref 두 개: 컨테이너, 텍스트
- mount 후 + resize observer: `textWidth > containerWidth` 이면 마퀴 모드
- 마퀴 모드:
  - 텍스트를 2번 렌더 (`{title}` `<span style="paddingLeft: 4vh">{title}</span>`)
  - framer-motion `<motion.div animate={{ x: [0, -overflowDistance] }}` `transition={{ duration: overflowDistance / SPEED, ease: "linear", repeat: Infinity, repeatType: "loop", repeatDelay: 1 }}`
  - `SPEED = 30 px/s` 정도
  - 처음 진입 시 1초 정지 (`delay: 1`)
- 정적 모드: `<span className="truncate">` (실제로 잘릴 일 없음)

## 빈 슬롯 처리

공지 < 4 인 페이지:

```tsx
{Array.from({ length: 4 }).map((_, i) => {
  const notice = pageNotices[i];
  if (!notice) return <div key={`empty-${i}`} className="rounded-[1.8vh]" style={{ background: "rgba(74,77,85,0.25)" }} />;
  return <NoticeCard ... />;
})}
```

빈 자리는 살짝 톤 다운된 카드 모양만 유지.

## 페이지 자동 회전

- 공지 > 4 일 때만: `setInterval` 10초마다 `pageIdx = (pageIdx + 1) % totalPages`
- 페이지 인디케이터 없음 (Figma 톤 유지)
- 드래그/스와이프 페이지 전환: 위젯에선 제거 (미니멀 톤 + 작은 폼팩터)

## 에러/로딩

- 로딩: 4개 빈 슬롯만 보이는 정적 화면 (스피너 없음). 헤더는 즉시 렌더.
- 에러: `/display` 패턴 축소 — 가운데 작은 빨간 박스 (`bg-red-400/10 border-red-400/30`).

## 비범위 (Out of Scope)

- `/display` 변경 — 사이니지 PC 외관 불변
- `/admin` 변경
- IPC 표면 확장 (preload 추가 메서드 없음 — 기존 `openExternal` 재사용)
- Electron 창 크기/위치 변경
- 자동 업데이트, 부트스트랩 로직 변경
- 읽음 상태의 서버 동기화 / 사용자별 인증 — 익명 PC 단위로 충분
- 빨간 점/배지 애니메이션 — 정적 표시만 (펄스/스파클 추가 X)

## 테스트 계획

1. **타입체크**: `npx tsc --noEmit` 통과
2. **빌드**: `npm run build` 통과
3. **시각 확인** (`npm run electron:dev`):
   - 짧은 제목 → 정적 표시
   - 긴 제목 (40+ 자) → 좌측 마퀴 슬라이드, 1초 정지 → 흘러감 → 반복
   - 카드 클릭 → 기본 브라우저(크롬 등)가 새 탭에서 `/display` 열림, 위젯은 그대로
   - 클릭한 카드의 빨간 점 사라짐, 좌하단 카운트 -1
   - 공지 5개 이상 등록 → 10초마다 페이지 회전, 카운트는 전체 공지 기준
   - 공지 3개만 있을 때 → 슬롯 4번째 비어있음
   - PinToggle 클릭 → 위젯이 다른 창 아래로 / 다시 위로
4. **읽음 사이클** (수동 시뮬레이션):
   - DevTools → Application → localStorage → `epl-widget-read-state` 의 `resetAt` 을 1시간 + 1분 전 ms 로 수정
   - 위젯 페이지 새로고침 또는 1분 대기 → 모든 빨간 점 부활, 카운트 = 전체 공지 수

## 가정

- 이 위젯은 `/widget` 단일 라우트만 책임진다. 위젯 전체 화면이 곧 위젯 창 내용.
- Electron 환경(`window.epl`) 와 일반 웹 환경 둘 다에서 동작 (웹은 fallback).
- localStorage 사용 가능 (Electron renderer 는 기본적으로 enable).
- 공지 수가 폭증 (수십 개 이상) 하는 시나리오는 OOS — 페이지 회전이 충분히 도는 한도 안에서 동작.
