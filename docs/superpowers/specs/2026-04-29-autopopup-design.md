# AutoPopup — 부팅 시 공지사항 사이트 자동 오픈

**작성일**: 2026-04-29
**대상**: Windows PC (사이니지 단말 외 일반 디스플레이용)

## 목적

USB로 PC에 복사해 한 번 더블클릭하면, 그 PC는 이후 부팅될 때마다 Chrome으로 `https://epl-s1.vercel.app/display` 를 최대화 창으로 자동 오픈한다.

## 사용자 흐름

1. USB에서 `setup-autopopup.bat` 을 대상 PC에 복사한다.
2. bat을 더블클릭한다.
3. "설치 완료" 메시지를 확인한다.
4. PC를 재부팅하면 Chrome이 자동으로 사이트를 띄운다.
5. setup.bat 자체는 더 이상 필요 없으므로 삭제 가능 (USB에 보관해도 무방).

## 결정사항

| 항목 | 선택 | 근거 |
|---|---|---|
| URL | `https://epl-s1.vercel.app/display` | 사용자 지정 |
| Chrome 모드 | 최대화 (`--start-maximized`) | 주소창·탭은 보이되 창은 최대화. 키오스크/풀스크린이 아닌 일반 창. |
| 자동 시작 메커니즘 | 시작 프로그램 폴더의 `.lnk` 단축키 | 관리자 권한 불필요, 사용자에게 보임, 제거 단순 |
| 시작 항목 형식 | `.lnk` (단축키) | 부팅 시 콘솔 창 깜빡임 없음 |
| 재실행 동작 | 멱등 — 같은 이름 단축키를 조용히 덮어씀 | 사용자가 같은 bat을 두 번 눌러도 안전 |

## 산출물

설치 후 PC 상태:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
└─ EPL 공지사항.lnk
   ├─ Target:    <감지된 chrome.exe 경로>
   ├─ Arguments: --start-maximized https://epl-s1.vercel.app/display
   └─ Window:    Normal
```

부팅 흐름:

1. PC 켜짐 → Windows 로그인 (자동로그인 가정)
2. Windows가 시작 폴더의 `.lnk` 자동 실행
3. Chrome이 최대화 상태로 사이트 오픈

## 컴포넌트 (단일 파일)

### `setup-autopopup.bat`

USB로 배포하는 유일한 파일. 의존성 없음 (Windows 기본 제공 cmd + PowerShell만 사용).

**책임:**
1. **Chrome 경로 탐지** — 다음 표준 경로를 순서대로 확인:
   - `%ProgramFiles%\Google\Chrome\Application\chrome.exe`
   - `%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe`
   - `%LocalAppData%\Google\Chrome\Application\chrome.exe`
2. **시작 프로그램 폴더에 `.lnk` 생성** — PowerShell `WScript.Shell.CreateShortcut` 호출로 한 줄 처리.
3. **결과 메시지 출력** — 성공/실패와 제거 방법 안내.

**파일 상단 주석 블록 (사용자가 메모장으로 열어도 즉시 이해):**

```bat
:: ============================================================
::  EPL 공지사항 자동 시작 설치 스크립트
::
::  하는 일:
::    1. Chrome 설치 경로를 찾는다
::    2. 시작 프로그램 폴더에 단축키 생성
::       → 부팅 시 https://epl-s1.vercel.app/display 자동 오픈
::
::  제거 방법:
::    Win+R → shell:startup → "EPL 공지사항.lnk" 삭제
:: ============================================================
```

## 출력 메시지

### 성공

```
[OK] Chrome 발견: C:\Program Files\Google\Chrome\Application\chrome.exe
[OK] 자동 시작 등록 완료: EPL 공지사항.lnk

부팅 시 https://epl-s1.vercel.app/display 가 자동으로 열립니다.

────────────── 제거 방법 ──────────────
  1. Win+R 키를 누른다
  2. shell:startup 입력 후 엔터
  3. "EPL 공지사항.lnk" 삭제
───────────────────────────────────────
계속하려면 아무 키나 누르세요...
```

### 에러

| 상황 | 메시지 | 종료 코드 |
|---|---|---|
| Chrome 못 찾음 | `[ERROR] Chrome이 설치되어 있지 않습니다. https://www.google.com/chrome 에서 먼저 설치해주세요.` | 1 |
| 단축키 생성 실패 | `[ERROR] 자동 시작 등록 실패. 메시지: <stderr>` | 2 |
| 재실행 (이미 설치됨) | `[INFO] 기존 등록을 덮어쓰는 중...` 후 정상 진행 | 0 |

## 비범위 (Out of Scope)

- 별도 uninstaller 스크립트 — 제거는 시작 폴더에서 단축키 삭제로 충분.
- Edge·Firefox 등 다른 브라우저 지원 — Chrome 전용.
- 자동 로그인 설정 — Windows 측에서 별도 구성 가정.
- Chrome 자동 업데이트, 복구 프롬프트 등 부가 옵션 — 일반 창 모드라 사용자/관리자가 직접 처리.
- Chrome이 비표준 경로에 설치된 경우 — 표준 3곳에 없으면 에러.

## 테스트 전략

자동화된 테스트는 부팅 시나리오라 어려움. 수동 검증:

1. **설치 검증** — bat 실행 후 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\` 에 `EPL 공지사항.lnk` 존재 확인, 속성에서 Target/Arguments 정확히 들어갔는지 확인.
2. **부팅 검증** — 재부팅 후 Chrome이 최대화 상태로 해당 URL을 띄우는지 확인.
3. **재실행 검증** — bat 두 번 클릭해도 단축키가 한 개만 남고, 내용이 동일한지 확인.
4. **Chrome 미설치 검증** — Chrome 경로를 일시적으로 막고 실행해 에러 메시지·종료 코드 1 확인.

## 가정

- 대상 PC는 Windows 10 또는 11.
- Chrome이 표준 경로 중 한 곳에 설치되어 있음.
- PC가 자동 로그인 설정이 되어 있거나, 운영자가 매번 로그인함.
- PC가 인터넷에 연결되어 있음 (vercel 배포본 접근 가능).
