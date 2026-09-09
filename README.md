# 캠퍼스 공지사항 (epl-s1)

Next.js + InstantDB 기반 실시간 학내 공지 시스템.
복도 디스플레이용 사이니지, 학생 PC 용 데스크톱 위젯, 교수용 어드민이 한 저장소 안에서 같은 DB를 본다.

| 경로 | 용도 | 형태 |
| --- | --- | --- |
| **`/display`** | 복도 디스플레이 전용 풀스크린 보드 | 웹 |
| **`/widget`** | 학생 PC 데스크톱 위젯이 로드하는 화면 | 웹 (Electron 렌더러) |
| **`/download`** | 위젯 다운로드 랜딩 (라이브 미리보기 + 최신 버전 표시) | 웹 |
| **`/download/latest`** | GitHub Releases 최신 인스톨러로 302 리다이렉트 | 웹 (route handler) |
| **`/admin`** | 비밀번호 게이트 + 공지 CRUD + AI 요약 대시보드 | 웹 |
| **`/api/summarize`** | 공지 본문 → AI 제목/요약 생성 (Ollama Cloud) | API |
| **`/api/fortune`** | 오늘의 운세 생성 | API |
| **`/api/cookie`** | 포춘쿠키 메시지 생성 | API |
| **EPL 공지사항 위젯** | 학생 PC 트레이 상주 위젯 (`bottom-right`, 배포 시 항상 다른 창 뒤) | Electron 앱 |

InstantDB 를 모든 화면이 실시간 구독하므로 어드민에서 공지를 올리면 디스플레이·위젯에 새로고침 없이 즉시 반영된다.

## 기술 스택

### 웹 (`src/`)
- **Next.js 16 (App Router)** · **React 19** · **TypeScript** · **Tailwind CSS v4**
- **[InstantDB](https://www.instantdb.com)** (`@instantdb/react`) — 백엔드 없이 프론트에서 실시간 CRUD / 실시간 구독
- **[Framer Motion](https://www.framer.com/motion/)** — 카드 enter / exit / layout 애니메이션, 위젯 페이지 회전·마퀴 모션
- **Ollama Cloud API** — AI 요약(`OLLAMA_MODEL`, 기본 `gpt-oss:120b`), 운세/포춘쿠키(`OLLAMA_FORTUNE_MODEL`/`OLLAMA_COOKIE_MODEL`, 기본 `gemma4:31b`). `OLLAMA_API_KEY` 필요.

### 데스크톱 위젯 (`electron/`)
- **Electron 42** — `bottom-right`, 단일 인스턴스. 배포 모드에선 `focusable:false` + `stayInBackground` 로 항상 다른 창 뒤에 깔림 (CLAUDE.md "포커스 정책" 참고)
- **electron-updater** — GitHub Releases 의 `latest.yml` 을 generic provider 로 폴링(기본 30분)해 백그라운드 자동 업데이트, 다음 정각 리셋 사이클에 자동 재시작/적용
- **electron-log** — 메인 프로세스 로깅
- **electron-builder** — Windows NSIS 인스톨러 빌드 (`EPL-공지사항-Setup-x.y.z.exe`)
- **부트스트랩 원격 설정** — 인스톨러에는 `bootstrapUrl` 하나만 박혀 있고, 위젯 URL / 창 크기 / 폴링 주기 / **킬스위치**는 모두 GitHub raw 의 `widget-config.json` 으로 원격 제어 (master 에 push 하면 다음 부팅/폴링에 반영)
- **z-order 워커** — ✕(맨 뒤로) 클릭 시 상주 PowerShell 워커가 `SetWindowPos(HWND_BOTTOM)` 를 수ms 내 실행

### 배포 / 운영
이중 배포 구조다. **git push 만으론 아무것도 배포되지 않는다.** 자세한 규칙은 [`CLAUDE.md`](./CLAUDE.md) "배포 규칙" 참고.

| 대상 | 어디로 | 어떻게 |
| --- | --- | --- |
| 렌더러 (`src/**`) | Vercel — `https://epl-s1.vercel.app` | `vercel --prod` (수동) |
| Electron 셸 (`electron/**`) | GitHub Releases — `jungminna03/epl-s1` | `npm run release` → 태그 푸시 → GitHub Actions 빌드/업로드 |

## 빠른 시작

### 1. InstantDB 앱 만들기

[instantdb.com/dash](https://www.instantdb.com/dash) 에서 새 앱을 만들고 App ID 를 복사.

### 2. 환경변수 설정

```bash
cp .env.example .env.local
# .env.local 에 채우기:
#   NEXT_PUBLIC_INSTANT_APP_ID  (필수)
#   OLLAMA_API_KEY              (AI 요약/운세/쿠키 쓸 때)
#   OLLAMA_MODEL                (선택, 기본 gpt-oss:120b)
```

### 3. 웹만 띄울 때

```bash
npm run dev
# http://localhost:3000/display
# http://localhost:3000/widget
# http://localhost:3000/admin
```

### 4. Electron 위젯까지 같이 띄울 때 (개발)

```bash
npm run electron:dev
# Next dev + electron tsc watch + electron 실행을 concurrently 로 띄움
# dev 모드에서는 자동 업데이트가 비활성화되고 widgetUrl 이 http://localhost:3000/widget 로 강제됨
# dev 모드 창은 focusable·이동/리사이즈 가능, 배포 모드는 전부 잠김
```

### 5. 릴리즈

**렌더러 (Vercel)** — `src/**` 만 바꿨을 때:

```bash
npm run build      # 로컬 빌드 통과 확인
vercel --prod      # epl-s1.vercel.app 에 alias. 위젯은 수초 내 새 코드로 동작
```

**Electron 셸 (GitHub Releases)** — `electron/**` 또는 새 IPC 가 필요할 때:

```bash
# 1. package.json 의 version 올리고 커밋 + origin 푸시
npm run release
# scripts/release.mjs 가 vX.Y.Z 태그를 만들어 github remote 로 푸시
# → .github/workflows/release.yml 이 Windows runner 에서 빌드 + Release 업로드
# 진행 상황: https://github.com/jungminna03/epl-s1/actions
```

- 학교 PC 들은 `pollIntervalMs`(기본 30분) 주기로 `latest.yml` 폴링 → 백그라운드 다운로드 → **다음 정각 리셋 사이클에 자동 재시작/적용**. 보통 30~60분 안에 전 PC 전환.
- 양쪽이 같이 바뀌면 **Electron 먼저** 올릴 것 (구버전 preload 사용자 보호).

## 폴더 구조

```
src/
├─ app/
│  ├─ layout.tsx             # 한국어 / 다크 테마 고정
│  ├─ page.tsx               # 랜딩 (display / widget / admin / download 진입)
│  ├─ display/page.tsx       # 복도 사이니지용 풀스크린 보드
│  ├─ widget/page.tsx        # 데스크톱 위젯 렌더러 (WIDGET_VERSION 상수 정의)
│  ├─ download/page.tsx      # 위젯 다운로드 랜딩 (/widget 라이브 iframe 미리보기)
│  ├─ download/latest/route.ts # GitHub Releases latest.yml → 최신 .exe 302 리다이렉트
│  ├─ admin/page.tsx         # 비밀번호 게이트 + 4탭 공지 CRUD + AI 요약
│  └─ api/
│     ├─ summarize/route.ts  # AI 제목/요약 생성 (제목-본문 매칭 검증 + 최대 3회 재시도)
│     ├─ fortune/route.ts    # 오늘의 운세 생성
│     └─ cookie/route.ts     # 포춘쿠키 생성
├─ components/
│  ├─ fortune/               # FortunePanel — 성별/생년월일 입력 → 운세 (focusable 토글)
│  ├─ cookie/                # CookiePanel — 주제 선택 → 포춘쿠키 (focusable 토글)
│  └─ widget/DragGrip.tsx    # 위젯 상단 드래그 그립 (창 이동, 화면 밖 클램프)
├─ lib/
│  ├─ instant.ts             # InstantDB init, schema 재export, Notice 타입
│  ├─ categories.ts          # 학년 카테고리 스타일/포맷터 + 게시 기간(자동 7일 만료)
│  ├─ notice-status.ts       # 공지 상태 분류 (active/upcoming/expired) + 어드민 탭
│  ├─ ai-summary.ts          # AI 메타 프롬프트/검증/길이 정책 (제목 30자, 요약 80자)
│  ├─ fortune.ts / cookie.ts # 운세/쿠키 클라이언트 유틸
│  ├─ release-notes.ts       # 어드민 업데이트 내역 패널 데이터
│  ├─ check-effects.ts       # "확인" 인터랙션 시각 효과
│  └─ widget-read-state.ts   # 위젯 로컬 "읽음" 상태 + 정각 리셋 + 업데이트 적용 훅
├─ globals.css               # Tailwind v4 + 폰트 변수

electron/
├─ main.ts                   # 앱 부트, 단일 인스턴스, IPC 라우팅, z-order 상주 워커
├─ bootstrap.ts              # 원격 widget-config.json fetch + 디스크 캐시 + 기본값 폴백
├─ widget-window.ts          # BrowserWindow 생성 / anchor 배치 / focusable 정책 / setWidgetInteractive
├─ tray.ts                   # 트레이 메뉴
├─ updater.ts                # electron-updater (generic provider, GitHub Releases)
├─ preload.ts                # contextBridge — window.epl API 노출
├─ config.ts                 # 빌드타임 상수 (BOOTSTRAP_URL, updateIntervalMs 등)
└─ tsconfig.json

scripts/
└─ release.mjs               # vX.Y.Z 태그 생성 → github remote 푸시 (Actions 가 빌드/업로드)

.github/workflows/release.yml # 태그 푸시 시 Windows 빌드 + Release 생성/업로드
widget-config.json            # 원격 부트스트랩 설정 (GitHub raw 로 서빙됨)
instant.schema.ts             # InstantDB 스키마 (npx instant-cli push schema 가 읽음)
electron-builder.yml          # NSIS 인스톨러 설정
```

## 데이터 스키마 (`instant.schema.ts`)

### `notices`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | InstantDB 자동 생성 |
| `title` | string | 공지 제목 (어드민 저장 시 AI 가 본문에서 자동 생성 가능) |
| `content` | string | 본문 |
| `category` | string | `''` 또는 `1학년` / `2학년` / `3학년` / `4학년` — 카드 색상/필터 결정 |
| `professor` | string? | 작성자 (교수명) |
| `link` | string? | 외부 링크 (있을 때 카드에서 바로 열기) |
| `createdAt` | number (ms) | `Date.now()` 타임스탬프, indexed |
| `startDate` | number? (ms) | 게시 시작 시각 (없으면 `createdAt`) |
| `endDate` | number? (ms) | 게시 종료 시각 (없으면 `start + 7일` 자동 만료) |
| `checkCount` | number? | "확인" 인터랙션 카운터 |
| `summary` | string? | AI 요약 (80자 이내). 어드민 저장 시 자동 생성, 백필 버튼으로 일괄 생성 가능 |

### `admins`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | InstantDB 자동 생성 |
| `name` | string | 교수명 |
| `position` | string | 직위/소속 |
| `password` | string | 비밀번호 |
| `createdAt` | number (ms) | indexed |

## 위젯 (`/widget` + Electron)

### UX 핵심
- **4 카드 × 최대 3 페이지** = 한 화면당 4개씩, 총 12개까지 자동 회전 (`PAGE_CYCLE_MS = 10s`).
- **상세 오버레이** — 카드 탭하면 layoutId 모션으로 확대, 그동안 자동 회전 멈춤. AI 요약 박스·관련 링크 카드·운세/포춘쿠키 버튼·"확인했어요" 버튼 포함.
- **AI 요약** — `summary` 가 있으면 상세 본문 스크롤 영역 상단에 카테고리 색 보더 박스로 표시.
- **오늘의 운세 / 포춘쿠키** — 상세에서 진입하는 미니 패널. 배포 모드 native input 을 위해 열려있는 동안만 `setFocusable(true)` 토글.
- **마퀴 제목** — 카드 제목이 잘리면 좌→우 스크롤. 상세 열린 동안 정지.
- **읽음 상태** — `localStorage` 에 영속화, 안 읽은 공지에 빨간 도트 + 헤더에 카운트 배지. **매 정각 전체 리셋** + 위젯이 맨 앞으로 복귀.
- **✕ (맨 뒤로)** — 헤더 우측 버튼. z-order 워커가 즉시 `HWND_BOTTOM` 처리, 1.5초 쿨다운.
- **상단 드래그 그립** — 점 6개 그립을 잡고 창 이동 (`setBounds` IPC, 화면 밖 클램프, 멀티모니터 지원).
- **하단 퀵바** — LMS / 포털 / 호서대 / 게임갤 바로가기. 시크릿 모드로 열고, 실패 시 일반 창 폴백 + 로그아웃 경고 토스트.
- **종료 임박 표시** — `endDate` 까지 24h 이내면 카드에 강조 표시.
- **확인 카운터** — "확인했어요" 버튼 누르면 `checkCount` 증가 + 시각 효과(`check-effects.ts`).
- **자동 만료** — `endDate` 미입력 공지는 시작 시점 +7일 후 자동으로 목록에서 사라짐 (`AUTO_PERIOD_DAYS`).

### Electron 동작
- **포커스 정책 (중요)** — 배포 모드는 `focusable:false` + focus 시 즉시 blur. 위젯은 절대 다른 창을 가리지 않는다. native input 이 필요한 패널은 `setWidgetInteractive` / `window.epl.setFocusable` 로 한시 토글. 상세 규칙·체크리스트는 [`CLAUDE.md`](./CLAUDE.md) 참고.
- **부트스트랩 순서** (`electron/bootstrap.ts`): 원격 `widget-config.json` (5초 타임아웃) → 실패 시 디스크 캐시 → 그것도 없으면 인스톨러 박힌 기본값. dev 모드는 원격 호출 없이 localhost 강제.
- **킬스위치** — `widget-config.json` 의 `kill: true` 로 바꾸면 위젯이 종료 메시지 띄우고 quit. 인스톨러 재빌드 없이 야생의 위젯들 한 번에 종료 가능.
- **네비게이션 화이트리스트** — `widget:navigate` IPC 는 `allowedNavigationHosts` 패턴(`*.foo.com` 지원)에 해당하는 호스트만 허용.
- **창 위치/크기** — `widget-config.json` 의 `window` (anchor / margin / 크기) 로 원격 제어. 기본 400×600, 우하단.
- **자동 업데이트** — GitHub Releases `latest.yml` 30분 폴링 → 백그라운드 다운로드 → 다음 정각 리셋 사이클에 `applyUpdateAndRestart()`.

### 위젯 버저닝

`V.YYYY.M.N` 형식 (예: `V.2026.6.8`). `src/app/widget/page.tsx` 의 `WIDGET_VERSION` 상수를 사람이 직접 갱신한다. 자세한 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 어드민 (`/admin`)

- **4탭** — 전체 / 활성 / 예정 / 종료 (`notice-status.ts` 의 상태 분류 기준).
- **AI 메타 생성** — 본문만 쓰면 저장 시 `/api/summarize` 가 제목+요약을 생성. 제목-본문 매칭 검증 후 불일치 시 최대 3회 재시도. 본문 미변경 수정은 기존 메타 재사용 (토큰 절감). 생성 중 풀스크린 로딩 오버레이.
- **AI 재생성 / 백필** — 공지별 재생성 버튼 + 요약 없는 공지 일괄 백필 버튼.
- **업데이트 내역** — 좌하단 동그라미 → 릴리스 노트 패널 (`release-notes.ts`).
- 데스크톱(1280px+)은 목록+폼 2열, 모바일은 탭 전환.

## 디자인 / UX 결정사항

- **다크 테마 고정** — 사이니지/위젯 모두 저조도 환경 가정.
- **학년 카테고리 컬러** — 1학년=Cyan, 2학년=Violet, 3학년=Emerald, 4학년=Orange.
- **하이브리드 레이아웃** — `/display` 는 가장 최근 공지를 상단에 핀, 나머지는 그리드. `/widget` 은 페이지 회전 그리드.
- **Framer Motion `layoutId`** — 그리드 카드 → 상세 오버레이 전환 시 부드럽게 morph.
- **인증** — 단순 비밀번호 게이트 (`sessionStorage`). 학내망/사이니지 단말 전용 가정.
- 기능별 상세 설계는 `docs/superpowers/specs/` 의 날짜별 디자인 스펙 참고.

## 운영 메모

- `widget-config.json` 은 운영 컨트롤 패널이다. `kill`, `widgetUrl`, `window`, `pollIntervalMs` 만 바꿔서 github remote 의 `main` 에 push 하면 야생의 위젯들이 다음 부팅/폴링 사이클(기본 30분)에 반영한다.
- 업데이트 피드: `https://github.com/jungminna03/epl-s1/releases/latest/download` (latest.yml + .exe + .blockmap)
- 부트스트랩 JSON: GitHub raw — `https://raw.githubusercontent.com/jungminna03/epl-s1/main/widget-config.json` (github remote 의 `main` 브랜치)
- 릴리스 빌드 상태: https://github.com/jungminna03/epl-s1/actions

## 보안 메모

어드민 비밀번호는 클라이언트 번들에 포함된다. 공개 인터넷에 노출되는 환경에서는 InstantDB Magic Code 인증 등으로 교체할 것. `OLLAMA_API_KEY` 는 서버(Vercel) 환경변수로만 두고 클라이언트에 노출하지 않는다.
