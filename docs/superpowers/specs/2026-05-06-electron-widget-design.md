# Electron 위젯 — 데스크톱 상시 위젯

**작성일**: 2026-05-06
**대상**: Windows PC (사이니지가 아닌 일반 데스크 PC — 교수·관리자 자리)

## 목적

캠퍼스 공지사항을 Steam 클라이언트처럼 동작시킨다:

1. **사이트로 배포** — 콘텐츠는 Vercel에 배포된 `https://epl-s1.vercel.app/widget` 을 그대로 로드. 콘텐츠 변경 즉시 반영.
2. **바탕화면 위젯** — frameless·transparent·always-on-top 작은 창이 작업표시줄에 나타나지 않고 화면 우하단에 떠 있다.
3. **컴퓨터 켜면 자동 시작** — 로그인 시 위젯 자동 실행.
4. **자동 업데이트** — 셸(Electron) 자체도 새 버전이 올라오면 백그라운드에서 받아 다음 실행 시 적용.

데이터는 InstantDB로 이미 실시간 동기화 중이므로 콘텐츠 측 폴링/업데이트는 별도 처리 불필요.

## 결정사항

| 항목 | 선택 | 근거 |
|---|---|---|
| 셸 | Electron 42 | 팀이 Node 친숙, 위젯 투명창은 Tauri보다 검증됨, 24/7 안정성. |
| 콘텐츠 로딩 | 원격 URL (`/widget`) | 콘텐츠 즉시 갱신, 셸은 가만히 둠. |
| 위젯 크기 | 360×520, 우하단 24px 여백 | 일반 1080p에서 작업 방해 없음. |
| 위젯 창 옵션 | frameless · transparent · alwaysOnTop("normal") · skipTaskbar | "바탕화면에 박힌" 느낌; 풀스크린은 가리지 않음. |
| 자동 시작 | `app.setLoginItemSettings({ openAtLogin: true })` | NSIS 설치 후 첫 실행 시 등록; 기존 `.bat`+`.lnk` 방식 대체. |
| 자동 업데이트 | `electron-updater` + generic provider → Vercel 정적 호스팅 | GitHub 미사용(repo는 Synology Gitea); Vercel에 매니페스트와 인스톨러를 정적 파일로 서빙. |
| 업데이트 폴링 | 부팅 직후 1회 + 30분 간격 | 학교 PC 사용 패턴상 충분. |
| 패키징 | NSIS one-click, perMachine: false | 관리자 권한 없이 사용자 폴더에 설치. |
| 코드 서명 | 미적용 (1차) | 인증서 비용 절약; SmartScreen "추가 정보" 1회 클릭 안내. |

## 폴더 구조

```
epl-s1/
├── electron/
│   ├── main.ts             메인 프로세스 — 단일 인스턴스, 자동시작 등록, IPC, 트레이/업데이터 부트스트랩
│   ├── preload.ts          contextBridge — quit/minimize/openExternal + updater:status 이벤트
│   ├── widget-window.ts    BrowserWindow 생성 (360x520, 우하단, 투명, 항상 위)
│   ├── tray.ts             트레이 아이콘 + 컨텍스트 메뉴 (보이기/숨기기, 항상 위, 종료)
│   ├── updater.ts          electron-updater 통합 — 30분 폴링, 진행 상태 IPC 푸시
│   ├── config.ts           dev/prod URL, 폴링 주기, 위젯 치수
│   └── tsconfig.json       → dist-electron/ 으로 컴파일
├── electron-resources/     electron-builder buildResources (icon.ico)
├── electron-builder.yml    NSIS 설정, generic publish provider
├── scripts/
│   └── release.mjs         빌드 → public/updates/ 복사 → vercel --prod 한 큐
├── src/app/widget/page.tsx /widget 라우트 — 컴팩트 카드 3개 + 헤더(드래그) + 푸터
└── dist-electron/, release/ (gitignored)
```

## 자동 업데이트 호스팅 — Vercel 정적 서빙

`electron-updater` 의 `generic` provider 가 가장 단순:

- 빌드 산출물(`*.exe`, `*.exe.blockmap`, `latest.yml`)을 `public/updates/` 로 복사
- `npm run release` 가 빌드 + 복사 + `vercel --prod` 까지 한 번에 실행
- `public/updates/` 는 .gitignore — 80MB 바이너리가 git에 들어가지 않음
- 결과 URL: `https://epl-s1.vercel.app/updates/latest.yml`

위젯이 부팅 시 매니페스트를 가져와 새 버전 발견하면 백그라운드 다운로드 → 다음 종료 시 설치.

## 사용자 흐름

### 최초 설치
1. 운영자가 `EPL-공지사항-Setup-x.y.z.exe` 를 학교 PC에 복사·실행
2. NSIS one-click 인스톨러가 사용자 폴더에 설치 → 즉시 위젯 실행 (`runAfterFinish: true`)
3. 첫 실행에서 `setLoginItemSettings` 가 자동 시작 등록
4. 위젯이 우하단에 뜨고 InstantDB로 즉시 데이터 표시

### 평상시
- PC 부팅 → 자동 로그인 → 위젯 자동 실행 → 30분 뒤 업데이트 체크
- 사용자: 헤더 드래그로 이동, `–` 누르면 트레이로 숨기기, 트레이 아이콘 클릭으로 다시 보이기

### 업데이트 배포 (운영자)
1. `package.json` version 증가 (e.g. 0.1.0 → 0.1.1)
2. `npm run release`
3. 30분 안에 모든 PC가 백그라운드 업데이트, 다음 부팅에 새 버전

## 비범위 (Out of Scope)

- macOS·Linux 빌드 — Windows 전용
- 코드 서명 — 1차에선 SmartScreen "추가 정보" 안내로 대체
- 위젯 크기 조절·다중 모니터 우선 표시 위치 선택 UI — 고정값
- 점진적 롤아웃·롤백 채널(beta/stable) — 단일 `latest` 채널
- 사이니지 PC용 풀스크린 모드 — 기존 `setup-autopopup.bat` 그대로 유지

## 가정

- 대상 PC는 Windows 10/11
- `https://epl-s1.vercel.app` 가 학교 네트워크에서 접근 가능
- Vercel 배포는 운영자 계정에서 `vercel --prod` 호출 가능 (Vercel CLI 로그인 상태)
- InstantDB 앱 ID는 빌드 시 환경 변수로 주입되어 Vercel 측 `/widget` 페이지가 정상 동작

## 빌드 환경 요구사항 (개발자/운영자만 해당)

`npm run electron:build` / `npm run release` 를 실행하는 PC는 다음 중 하나가 필요하다 (electron-builder가 다운로드하는 winCodeSign 캐시에 macOS 심볼릭 링크가 포함되어 있어 Windows에서 압축 해제하려면 권한이 필요함):

- **권장**: Windows 설정 → 개인정보 및 보안 → 개발자용 → "개발자 모드" ON. 이후 일반 사용자 권한으로 빌드 가능.
- 대안: 첫 빌드 한 번만 PowerShell을 관리자 권한으로 열어 `npm run electron:build` 실행 (캐시가 채워진 뒤로는 일반 권한으로 OK).

엔드 유저(설치만 하는 학교 PC)는 이 설정 불필요 — 인스톨러는 일반 권한으로 동작.

## Vercel CLI 준비 (운영자 1회)

```powershell
npm i -g vercel
vercel login        # 학과 운영 계정으로 로그인
vercel link         # 이 폴더를 epl-s1 프로젝트와 연결
```

이후 `npm run release` 만으로 빌드+배포가 자동.
