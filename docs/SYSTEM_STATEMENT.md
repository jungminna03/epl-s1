# EPL-S1 시스템 명세 (System Statement)

> 이 문서는 epl-s1 시스템의 **현재 동작 기준** 명세다.
> 2026-05-07 작성된 초기 기획(NoticeWidget 요구사항 정의)을 대체한다 — 초기 기획과 달라진 부분은 전부 현재 구현이 정답.
> 기능별 상세 설계 이력은 `docs/superpowers/specs/` 의 날짜별 디자인 스펙 참고.

## 1. 시스템 개요

게임소프트웨어학과 캠퍼스 공지사항 시스템. 하나의 저장소에서 세 가지 화면과 데스크톱 위젯을 제공하고, 모두 같은 InstantDB 를 실시간 구독한다.

```
                 ┌──────────────────────────────┐
                 │   InstantDB (notices/admins)  │
                 └──────┬─────────┬─────────┬───┘
              실시간 구독 │         │         │
        ┌───────────────┘         │         └───────────────┐
        ▼                         ▼                         ▼
  /admin (교수용)            /display (복도)            /widget (학생 PC)
  공지 CRUD + AI 요약        풀스크린 사이니지            Electron 위젯 렌더러
                                                          ▲ loadURL
                                              ┌───────────┴───────────┐
                                              │  Electron 셸 (설치본)   │
                                              │  GitHub Releases 배포  │
                                              └───────────────────────┘
```

| 구성요소 | 위치 | 배포 |
| --- | --- | --- |
| 웹 (렌더러 포함) | `src/**` | Vercel — `vercel --prod` (수동) |
| Electron 셸 | `electron/**` | GitHub Releases — `npm run release` (태그 → Actions 빌드) |
| 원격 운영 설정 | `widget-config.json` | GitHub raw (`main` 브랜치) — push 만으로 반영 |

현재 버전 (2026-06-05 기준): 앱 `1.0.0`, 위젯 `V.2026.6.8`.

> 앱(Electron 셸 설치본)은 `1.0.0` 부터 정식 릴리즈 — `1.0.X` semver 로 관리한다. (`0.2.X` 는 정식 릴리즈 전 베타 버전대)

## 2. 라우트

| 라우트 | 역할 |
| --- | --- |
| `/` | 랜딩 — display / widget / admin / download 진입 |
| `/display` | 복도 디스플레이 사이니지. 10초 페이지 순환, 상세에 AI 요약 + 운세/포춘쿠키 |
| `/widget` | 위젯 렌더러. Electron 이 loadURL 로 로드 (dev: localhost:3000, prod: epl-s1.vercel.app) |
| `/admin` | 비밀번호 게이트 + 4탭 공지 CRUD + AI 메타 생성 |
| `/download` | 위젯 다운로드 랜딩 — 카피 + 다운로드 버튼 + `/widget` 라이브 iframe 미리보기, latest.yml 에서 버전 표시 |
| `/download/latest` | GitHub Releases `latest.yml` 을 읽어 최신 `.exe` 로 302 리다이렉트 |
| `/api/summarize` | 본문 → AI 제목+요약 (`gpt-oss:120b`, 제목-본문 매칭 검증 + 최대 3회 재시도) |
| `/api/fortune` | 성별/생년월일/출생시간 → 오늘의 운세 (`gemma3:4b`) |
| `/api/cookie` | 주제 → 포춘쿠키 메시지 (`gemma3:4b`) |
| `/fortune-test`, `/cookie-test` | 개발용 테스트 페이지 |

AI API 공통: Ollama Cloud (`https://ollama.com`), 인증 `OLLAMA_API_KEY`, 타임아웃 15초.

## 3. 데이터 계층

스키마는 `instant.schema.ts`, 필드 표는 README 참고. 핵심 규칙:

- **노출 기간** (`src/lib/categories.ts`) — `startDate`(없으면 `createdAt`) ~ `endDate`(없으면 시작 +7일). 기간 밖 공지는 display/widget 에서 숨김.
- **상태 분류** (`src/lib/notice-status.ts`) — `upcoming`(시작 전) / `active`(게시 중) / `expired`(종료). 어드민 4탭(전체/활성/예정/종료)의 기준.
- **AI 요약** — `summary` 필드 (80자 이내). 어드민 저장 시 자동 생성, 제목도 본문에서 자동 생성 가능 (30자 이내).

## 4. 위젯 화면 (`/widget`)

400×600 고정 창에 로드되는 페이지. `WIDGET_VERSION` 상수는 `src/app/widget/page.tsx` 에 정의.

### 헤더
- 좌측: 위젯 버전 (`V.YYYY.M.N`)
- 제목: "게임소프트웨어학과 공지사항" (그라데이션 + 펄싱 도트)
- 우측: 안 읽은 공지 수 배지 (0개 회색, 99 초과 시 `99+`) + **✕ (맨 뒤로)** 버튼
- ✕ 클릭 → `sendToBack()` → 상주 z-order 워커가 `SetWindowPos(HWND_BOTTOM)` 즉시 실행, 쿨다운 1.5초

### 본문
- **공지 카드** — 페이지당 4개 × 최대 3페이지(12개), 10초 자동 순환. 그라데이션 보더, 마퀴 제목, 안 읽음 빨간 도트, 종료 24h 이내 노란 테두리 강조
- **상단 드래그 그립** — 점 그립을 잡고 창 이동 (`setBounds` IPC). 화면 밖 클램프, 멀티모니터 지원, dev/배포 공통
- **하단 퀵바** — LMS / 포털 / 호서대 / 게임갤. `openExternalIncognito()` 로 시크릿 모드 열기, 실패 시 일반 창 폴백 + "로그아웃하세요" 경고 토스트 6초

### 상세 오버레이
카드 클릭 → Framer Motion layoutId 확대. 구성: 카테고리 배지 / 제목 / 작성일 / **AI 요약 박스**(본문 스크롤 영역 상단, 카테고리 색 보더) / 본문 / 관련 링크 카드(`openExternal`) / **운세·포춘쿠키 버튼** / "확인했어요" 버튼(`checkCount` 증가 + 효과 + 350ms 후 닫힘).

### 운세 / 포춘쿠키 패널
- FortunePanel: 입력(성별·생년월일·출생시간) → 로딩 → 결과(별점·본문·행운 색/방위/숫자)
- CookiePanel: 주제 선택 → 로딩 → 결과(메시지 + 행운 키워드 3개)
- 둘 다 mount 시 `window.epl.setFocusable(true)`, unmount 시 `false` — 배포 모드 native input 동작을 위한 한시 토글 (CLAUDE.md 포커스 정책)

### 읽음 상태 (`src/lib/widget-read-state.ts`)
- `localStorage` 에만 저장 (DB 미동기)
- **매 정각 전체 리셋** — 모든 공지가 다시 "안 읽음" + `bringToFront()` 로 위젯 맨 앞 복귀
- 다운로드된 업데이트가 대기 중이면 이 시점에 `applyUpdateAndRestart()` 호출 (사용자 액션 0 으로 새 버전 적용)

## 5. Electron 셸 (`electron/**`)

### 창 정책
| 항목 | dev | 배포 |
| --- | --- | --- |
| 크기/위치 | 400×600, 이동/리사이즈 가능 | 400×600 고정, 우하단 앵커 (margin 24px) |
| focusable | true | **false** + focus 시 즉시 blur |
| z-order | 보통 | `stayInBackground` — 항상 다른 창 뒤 |
| 닫기/Alt+F4 | 허용 | 차단 |
| 작업 표시줄 | 표시 | 미표시 (트레이만) |

포커스가 필요한 패널은 `setWidgetInteractive(win, value)` (IPC: `window.epl.setFocusable`) 로 한시 토글. 상세 규칙·신규 패널 체크리스트는 CLAUDE.md 참고.

### 부트스트랩 (`bootstrap.ts`)
인스톨러에 frozen 된 값은 `bootstrapUrl` 하나뿐. 부팅 시 ① 원격 `widget-config.json`(5초 타임아웃) → ② 디스크 캐시 → ③ 내장 기본값 순으로 폴백. dev 는 원격 호출 없이 localhost 강제.

원격으로 제어 가능한 것: `widgetUrl` / `updateFeedUrl` / `pollIntervalMs` / 창 크기·앵커 / `allowedNavigationHosts` / **킬스위치** (`kill: true` → 종료 메시지 후 quit).

### 자동 업데이트 (`updater.ts`)
- electron-updater generic provider, 피드: `https://github.com/jungminna03/epl-s1/releases/latest/download`
- 30분 주기 `latest.yml` 폴링 → 백그라운드 다운로드 → 다음 정각 리셋 사이클에 자동 재시작/적용
- 배포 후 보통 30~60분 내 전 PC 전환

### z-order 워커 (`main.ts`)
앱 시작 시 PowerShell 프로세스를 상주시켜 두고, ✕ 클릭 시 stdin 으로 HWND 만 흘려 `SetWindowPos(HWND_BOTTOM)` 를 수ms 내 실행. 워커가 죽으면 1회성 PowerShell 폴백.

### 트레이 (`tray.ts`)
공지 새로고침 / [dev] 맨 위 고정 토글 / [dev] 위치 초기화 / 버전 정보 / 종료(배포는 관리자 권한 필요).

### preload (`window.epl`)
라이프사이클(quit/restart/hide/show/reload/navigate), 외부 열기(openExternal / openExternalIncognito), 창 조작(setBounds / setFocusable / sendToBack / setOpacity / setZoomFactor / setIgnoreMouseEvents), 멀티모니터(getDisplays / moveToDisplay), 업데이트(forceUpdateCheck / applyUpdateAndRestart / onUpdateStatus), 설정(getConfig / onConfigReloaded), 디버그(openDevTools / log / getNativeInfo).

## 6. 어드민 (`/admin`)

- 비밀번호 게이트 (sessionStorage 유지)
- **4탭**: 전체 / 활성 / 예정 / 종료
- 공지 작성·수정 폼: 본문(필수) / 카테고리 / 링크 / 시작일(기본 오늘) / 종료일(비우면 +7일)
- **AI 메타 흐름**: 본문이 바뀌었을 때만 `/api/summarize` 호출 → 제목+요약 생성 (풀스크린 로딩 오버레이). 본문 미변경 수정은 기존 메타 재사용
- 공지별 **AI 재생성** 버튼 + 요약 없는 공지 **일괄 백필** 버튼
- 좌하단 동그라미 → **업데이트 내역 패널** (`src/lib/release-notes.ts`)
- 데스크톱 2열(목록+sticky 폼) / 모바일 탭 전환

## 7. 버저닝 / 배포

- **앱 버전** (`package.json`): semver. Electron 셸 릴리스 단위
- **위젯 버전** (`WIDGET_VERSION`): `V.년도.월.업데이트횟수` — 렌더러 변경 단위. 규칙은 CLAUDE.md
- **이중 배포**: `src/**` → Vercel(`vercel --prod`), `electron/**` → GitHub Releases(`npm run release`). 같이 바뀌면 Electron 먼저. 절차 전체는 CLAUDE.md "배포 규칙"

## 📅 문서 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-05-07 | 초기 기획 및 요구사항 정의 (NoticeWidget 요구사항 문서) |
| 2026-06-05 | 현재 구현 기준으로 전면 재작성 — AI 요약/운세/포춘쿠키/퀵바/드래그 그립/z-order 워커/GitHub Releases 배포 반영 |
