# 캠퍼스 공지사항 (epl-s1)

Next.js + InstantDB 기반 실시간 학내 공지 시스템.
복도 디스플레이용 사이니지, 학생 PC 용 데스크톱 위젯, 교수용 어드민이 한 저장소 안에서 같은 DB를 본다.

| 경로 | 용도 | 형태 |
| --- | --- | --- |
| **`/display`** | 복도 디스플레이 전용 풀스크린 보드 | 웹 |
| **`/widget`** | 학생 PC 데스크톱 위젯이 로드하는 화면 | 웹 (Electron 렌더러) |
| **`/download`** | 위젯 인스톨러 다운로드 페이지 | 웹 |
| **`/admin`** | 비밀번호 게이트 + 공지 CRUD 대시보드 | 웹 |
| **EPL 공지사항 위젯** | 학생 PC 트레이 상주 위젯 (`bottom-right`, always-on-top) | Electron 앱 |

InstantDB 를 모든 화면이 실시간 구독하므로 어드민에서 공지를 올리면 디스플레이·위젯에 새로고침 없이 즉시 반영된다.

## 기술 스택

### 웹 (`src/`)
- **Next.js 16 (App Router)** · **React 19** · **TypeScript** · **Tailwind CSS v4**
- **[InstantDB](https://www.instantdb.com)** (`@instantdb/react`) — 백엔드 없이 프론트에서 실시간 CRUD / 실시간 구독
- **[Framer Motion](https://www.framer.com/motion/)** — 카드 enter / exit / layout 애니메이션, 위젯 페이지 회전·마퀴 모션

### 데스크톱 위젯 (`electron/`)
- **Electron 42** — `bottom-right`, `alwaysOnTop`, 단일 인스턴스
- **electron-updater** — Vercel Blob 의 `latest.yml` 을 generic provider 로 폴링해 백그라운드 자동 업데이트
- **electron-log** — 메인 프로세스 로깅
- **electron-builder** — Windows NSIS 인스톨러 빌드 (`EPL-공지사항-Setup-x.y.z.exe`)
- **부트스트랩 원격 설정** — 인스톨러에는 `bootstrapUrl` 하나만 박혀 있고, 위젯 URL / 창 크기 / 폴링 주기 / **킬스위치**는 모두 Vercel Blob 의 `widget-config.json` 으로 원격 제어

### 배포 / 운영 (`scripts/`)
- **[@vercel/blob](https://vercel.com/docs/storage/vercel-blob)** — `latest.yml`, `*.exe`, `*.exe.blockmap`, `widget-config.json` 호스팅
- **Vercel** — 웹 페이지(`/display`, `/widget`, `/admin`, `/download`) 호스팅
- **`npm run release`** — Electron 빌드 → Blob 업로드 → `vercel --prod` 까지 한 번에

## 빠른 시작

### 1. InstantDB 앱 만들기

[instantdb.com/dash](https://www.instantdb.com/dash) 에서 새 앱을 만들고 App ID 를 복사.

### 2. 환경변수 설정

```bash
cp .env.example .env.local
# .env.local 의 NEXT_PUBLIC_INSTANT_APP_ID, NEXT_PUBLIC_ADMIN_PASSWORD 채우기
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
```

### 5. 릴리즈 (Windows 위젯 + 웹)

```bash
# BLOB_READ_WRITE_TOKEN 이 환경변수 또는 .env.vercel.tmp 에 있어야 함
# (없다면) npx vercel env pull .env.vercel.tmp --environment=production
npm run release
```

- `package.json` 의 `version` 을 올린 뒤 실행.
- `release/` 의 산출물 3종(`latest.yml`, `*.exe`, `*.exe.blockmap`) + `widget-config.json` 이 Vercel Blob 에 업로드되고, 마지막에 `vercel --prod` 가 호출된다.
- 학교 PC 들은 `pollIntervalMs` (기본 30분) 안에 `latest.yml` 폴링 → 새 버전 발견 시 백그라운드 다운로드 → 다음 종료 시 자동 설치.

## 폴더 구조

```
src/
├─ app/
│  ├─ layout.tsx          # 한국어 / 다크 테마 고정
│  ├─ page.tsx            # 랜딩 (display / widget / admin / download 진입)
│  ├─ display/page.tsx    # 복도 사이니지용 풀스크린 보드
│  ├─ widget/page.tsx     # 데스크톱 위젯 렌더러 (Electron 이 로드)
│  ├─ download/page.tsx   # 위젯 인스톨러 다운로드 안내
│  └─ admin/page.tsx      # 비밀번호 게이트 + 공지 CRUD 대시보드
├─ lib/
│  ├─ instant.ts          # InstantDB init, schema 재export, Notice 타입
│  ├─ categories.ts       # 학년 카테고리 스타일/포맷터 + 게시 기간(자동 7일 만료)
│  ├─ check-effects.ts    # "확인" 인터랙션 시각 효과
│  └─ widget-read-state.ts# 위젯 로컬 "읽음" 상태 영속화
├─ globals.css            # Tailwind v4 + 폰트 변수

electron/
├─ main.ts                # 앱 부트, 단일 인스턴스, IPC 라우팅
├─ bootstrap.ts           # 원격 widget-config.json fetch + 디스크 캐시 + 기본값 폴백
├─ widget-window.ts       # BrowserWindow 생성 / anchor 기반 배치
├─ tray.ts                # 트레이 메뉴
├─ updater.ts             # electron-updater (generic provider, Vercel Blob)
├─ preload.ts             # contextBridge — eplApi 노출
├─ config.ts              # 빌드타임 상수 (BOOTSTRAP_URL 등)
└─ tsconfig.json

scripts/
└─ release.mjs            # 빌드 → Blob 업로드 → vercel --prod 원샷

widget-config.json        # 원격 부트스트랩 설정 (Blob 에 그대로 업로드됨)
instant.schema.ts         # InstantDB 스키마 (npx instant-cli push schema 가 읽음)
electron-builder.yml      # NSIS 인스톨러 설정
```

## 데이터 스키마 (`instant.schema.ts`)

### `notices`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | uuid | InstantDB 자동 생성 |
| `title` | string | 공지 제목 |
| `content` | string | 본문 |
| `category` | string | `''` 또는 `1학년` / `2학년` / `3학년` / `4학년` — 카드 색상/필터 결정 |
| `professor` | string? | 작성자 (교수명) |
| `link` | string? | 외부 링크 (있을 때 카드에서 바로 열기) |
| `createdAt` | number (ms) | `Date.now()` 타임스탬프, indexed |
| `startDate` | number? (ms) | 게시 시작 시각 (없으면 `createdAt`) |
| `endDate` | number? (ms) | 게시 종료 시각 (없으면 `start + 7일` 자동 만료) |
| `checkCount` | number? | "확인" 인터랙션 카운터 |

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
- **상세 오버레이** — 카드 탭하면 layoutId 모션으로 확대, 그동안 자동 회전 멈춤. 닫기 전엔 자동 복귀 없음.
- **마퀴 제목** — 카드 제목이 잘리면 좌→우 스크롤. 상세 열린 동안 정지.
- **읽음 상태** — `localStorage` 에 영속화, "안 본 공지" 카운트 배지 표시 (`widget-read-state.ts`).
- **종료 임박 표시** — `endDate` 까지 24h 이내면 카드에 강조 표시.
- **확인 카운터** — 카드의 "확인" 버튼 누르면 `checkCount` 증가 + 시각 효과(`check-effects.ts`).
- **자동 만료** — `endDate` 미입력 공지는 시작 시점 +7일 후 자동으로 목록에서 사라짐 (`AUTO_PERIOD_DAYS`).

### Electron 동작
- **부트스트랩 순서** (`electron/bootstrap.ts`): 원격 `widget-config.json` (5초 타임아웃) → 실패 시 디스크 캐시 → 그것도 없으면 인스톨러 박힌 기본값.
- **킬스위치** — `widget-config.json` 의 `kill: true` 로 바꾸면 위젯이 종료 메시지 띄우고 quit. 인스톨러 재빌드 없이 야생의 위젯들 한 번에 종료 가능.
- **네비게이션 화이트리스트** — `widget:navigate` IPC 는 `allowedNavigationHosts` 패턴(`*.foo.com` 지원)에 해당하는 호스트만 허용.
- **창 위치/크기** — `widget-config.json` 의 `window` (anchor / margin / 크기 / always-on-top) 로 원격 제어.

### 위젯 버저닝

`V.YYYY.M.N` 형식 (예: `V.2026.5.6`). `src/app/widget/page.tsx` 의 `WIDGET_VERSION` 상수를 사람이 직접 갱신한다. 자세한 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 디자인 / UX 결정사항

- **다크 테마 고정** — 사이니지/위젯 모두 저조도 환경 가정.
- **학년 카테고리 컬러** — 1학년=Cyan, 2학년=Violet, 3학년=Emerald, 4학년=Orange.
- **하이브리드 레이아웃** — `/display` 는 가장 최근 공지를 상단에 핀, 나머지는 그리드. `/widget` 은 페이지 회전 그리드.
- **Framer Motion `layoutId`** — 그리드 카드 → 상세 오버레이 전환 시 부드럽게 morph.
- **인증** — 단순 비밀번호 게이트 (`sessionStorage`). 학내망/사이니지 단말 전용 가정.

## 운영 메모

- `widget-config.json` 은 운영 컨트롤 패널이다. `kill`, `widgetUrl`, `window`, `pollIntervalMs` 만 바꿔도 야생의 위젯들이 다음 폴링 사이클(기본 30분)에 반영한다.
- `latest.yml` 매니페스트: `https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/latest.yml`
- 부트스트랩 JSON: `https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json`

## 보안 메모

`NEXT_PUBLIC_ADMIN_PASSWORD` 는 클라이언트 번들에 포함된다. 공개 인터넷에 노출되는 환경에서는 InstantDB Magic Code 인증 등으로 교체할 것.
