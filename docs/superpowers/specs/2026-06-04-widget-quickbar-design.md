# 위젯 하단 바로가기 퀵바 (시크릿 모드) — 디자인 스펙

- 날짜: 2026-06-04
- 상태: 승인됨 (비주얼 컴패니언 브레인스토밍으로 확정)
- 위젯 버전: V.2026.6.6 / 셸 버전: 0.2.13

## 목적

학생들이 위젯에서 바로 학교 주요 사이트로 이동할 수 있게 한다. 공용 캠퍼스 PC
특성상 **이전 사용자의 로그인 세션이 남으면 안 되므로** 모든 바로가기는
**시크릿(InPrivate) 모드**로 연다.

## 결정 사항 (브레인스토밍 결과)

| 결정 | 선택 | 탈락안 |
| --- | --- | --- |
| 배치 | 하단 고정 퀵바 (페이지 네비 아래 한 줄) | 헤더 아이콘, 고정 공지 카드, 탭바+모음 창 |
| 디자인 | 카드형 (NoticeCard 그라데이션 보더 재활용) | pill 버튼, 텍스트 링크 |
| 레이아웃 | 1행 4버튼 컴팩트 (아이콘+짧은 라벨, 도메인 생략) | 2×2 그리드 (도메인 표기) |
| 브라우저 | Chrome `--incognito` 우선, 없으면 Edge `-inprivate` | Edge 고정, 기본 브라우저 감지 |

## 바로가기 목록 (하드코딩)

| 라벨 | URL |
| --- | --- |
| 📚 LMS | `https://learn.hoseo.ac.kr/login/index.php` |
| 🏫 포털 | `https://sso.hoseo.edu/svc/tk/Auth.do?id=NEW_PORTAL&ac=Y&RelayState=%2Findex.jsp&ifa=N&` |
| 🏛️ 호서대 | `https://www.hoseo.ac.kr/Home/Main.mbz` |
| 🎮 게임갤 | `https://hoseogamegal.netlify.app/` |

추후 추가는 `QUICK_LINKS` 상수에 항목만 늘리면 된다 (4개 초과 시 레이아웃 재검토).

## 구성

### 1. 렌더러 — `QuickBar` (src/app/widget/page.tsx)

- `WidgetFrame` 안 `NoticeGrid` 아래 `shrink-0` 한 줄. 로딩/에러 상태에서도 표시.
- `QUICK_LINKS: { icon, label, url }[]` 상수 4개.
- 버튼 스타일: NoticeCard 와 동일한 그라데이션 보더(`#1a2233` + cyan→violet),
  `vh` 단위, hover/active 톤 통일.
- 클릭 → `openExternalIncognito(url)` 헬퍼.

### 2. Electron — 시크릿 모드 IPC

- `electron/main.ts`: `ipcMain.on("widget:open-external-incognito")`
  - URL 검증: 기존 `widget:open-external` 과 동일한 `https?://` 체크.
  - 브라우저 탐색 (`fs.existsSync` 순차):
    1. Chrome — `Program Files` → `Program Files (x86)` → `%LOCALAPPDATA%`, 플래그 `--incognito`
    2. Edge — `Program Files (x86)` → `Program Files`, 플래그 `-inprivate`
  - `spawn(exe, [flag, url], { detached: true, stdio: "ignore" }).unref()`
    — 인자 배열 전달이라 셸 인젝션 없음. `error` 이벤트 리스너로 spawn 실패 캐치.
  - 미발견/실패 시 `shell.openExternal()` 일반 모드 폴백 + `log.warn`.
- `electron/preload.ts`: `openExternalIncognito(url): Promise<boolean>` 노출 +
  `Window.epl` 타입 추가. IPC 는 `invoke` — main 이 시크릿 성공 여부를 돌려준다.
- 렌더러 폴백 체인: `epl.openExternalIncognito` → `epl.openExternal` → `window.open`
  (구버전 셸/웹 모드에서도 동작 유지, 시크릿만 미적용).

### 2-1. 폴백 경고 (리뷰 반영)

시크릿 폴백이 **조용히** 일어나면 학생이 시크릿인 줄 알고 LMS/포털에 로그인
→ 공용 PC 에 세션이 남는 사고가 난다 (멀티 렌즈 리뷰 확정 발견 사항).
그래서 폴백 경로 전부(브라우저 미발견, spawn 실패, 구버전 preload, 웹 모드)에서
`openExternalIncognito` 가 `false` 를 반환하고, QuickBar 가 6초간 경고 토스트
("⚠️ 시크릿 모드로 못 열어 일반 창으로 열렸어요 — 사용 후 꼭 로그아웃하세요")
를 띄운다.

### 3. 포커스 정책 영향

단순 click 버튼이므로 위젯의 focusable:false 정책과 충돌 없음 (CLAUDE.md 참조).
`setFocusable` 토글 불필요.

## 배포

`electron/**` 변경 포함 → **이중 배포 필요. Electron 릴리스 먼저, Vercel 다음.**

1. `package.json` 0.2.12 → 0.2.13, `npm run release` (GitHub Releases)
2. `vercel --prod`

순서 이유: Vercel 먼저 올리면 구버전 preload 사용자에게서 새 IPC 가 없어
일반 모드 폴백으로만 동작. 역순이면 안전 (렌더러 feature-detect).

## 검증

- `npm run build` + `npx tsc --noEmit` + `npm run electron:tsc`
- dev 모드에서 4개 버튼 클릭 → Chrome 시크릿 창으로 열리는지 수동 확인
  (개발 기기에서 Chrome/Edge 설치 경로 실재 확인 완료)
