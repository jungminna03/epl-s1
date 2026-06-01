# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# 문서 위치 규칙

- 모든 프로젝트 문서(스펙, 설계, 회의록, 분석, 가이드 등)는 **`docs/`** 폴더 아래에 둔다. 루트나 `src/` 에 흩뿌리지 말 것.
- 하위 분류 예: `docs/specs/`, `docs/design/`, `docs/guides/`, `docs/superpowers/`.
- 새 문서를 만들 땐 먼저 `docs/` 안에 적절한 하위 폴더가 있는지 확인하고, 없으면 만든 뒤 그 안에 둔다.
- `README.md`, `CLAUDE.md` 처럼 도구가 루트에서 읽는 표준 파일만 예외다.

# Claude Code 플러그인 협업 규칙

이 저장소는 Claude Code 로 협업한다. 플러그인 설정은 두 단계로 분리한다.

| 파일 | 용도 | git |
| --- | --- | --- |
| `.claude/settings.json` | **팀 공통** 플러그인 / 마켓플레이스 / 권한 | 커밋 |
| `.claude/settings.local.json` | **개인** 플러그인 및 로컬 오버라이드 | gitignore (커밋 X) |

- 팀 전체가 써야 하는 플러그인은 `.claude/settings.json` 의 `extraKnownMarketplaces` 와 `enabledPlugins` 에 추가하고 PR 로 합의한다.
- 본인만 쓰는 플러그인은 `.claude/settings.local.json.example` 을 `settings.local.json` 으로 복사해서 거기에 추가한다. 이 파일은 `.gitignore` 에 의해 커밋되지 않는다.
- 키 우선순위: `settings.local.json` > `settings.json` > `~/.claude/settings.json`. 충돌 시 로컬이 이긴다.
- 활성 플러그인 확인: `/plugin` 또는 `/status`.

# 외부 의존성 통제 (사전 승인 룰)

Claude / 협업자가 막혔다고 새 라이브러리를 임의 추가하지 않게 한다.

- **금지**: `package.json` 의 `dependencies` / `devDependencies` / `optionalDependencies` / `peerDependencies` 를 추가·변경하는 모든 행위.
- **허용**: lockfile 동기화용 `npm install` (인자 없음) / `npm ci` 만 허용.
- **새 패키지가 필요하다고 판단되면**: 즉시 설치하지 말고 사용자에게 먼저 다음 4가지를 제시할 것.
  1. 풀어야 할 문제
  2. 후보 라이브러리 1~3 개 (각각 크기/메인테넌스 상태/라이선스 간략 명시)
  3. 자체 구현 대안 (가능한 경우)
  4. 추천안과 그 이유
- 사용자가 명시 승인한 뒤에만 설치한다.
- `.claude/settings.json` 의 `permissions.deny` 에 `npm install *`, `npm add *`, `yarn add *`, `pnpm add *`, `bun add *` 등이 등록돼 있어 권한 단에서도 한 번 더 차단된다.

# 커밋 / 브랜치 컨벤션

- **커밋 메시지**: `[TAG] 한국어 설명` 형식. 헤드 태그는 대문자 대괄호로 시작하고, 본문은 한국어로 간결하게.
  - 태그: `[ADD]` (새 기능/파일), `[FIX]` (버그 수정), `[UPDATE]` (기존 기능 개선), `[REFACTOR]` (리팩터링), `[REMOVE]` (제거), `[STYLE]` (코드 포맷/스타일), `[DOCS]` (문서), `[CHORE]` (설정/잡일), `[TEST]` (테스트), `[BUILD]` (빌드 시스템), `[CI]` (CI 설정), `[PERF]` (성능)
  - 예: `[ADD] 공지 자동 회전 기능`, `[FIX] 자동 업데이트 다운로드 오류`, `[REFACTOR] 위젯 상태 훅 분리`
  - 한 커밋엔 태그 하나만. 어디를 건드렸는지 본문에 자연스럽게 녹여 쓰기 (별도 scope 표기 안 함).
- **브랜치 이름**: `<type>/<짧은-설명>` (kebab-case, 영문)
  - 타입: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `style`, `perf`
  - 예: `feat/notice-rotation`, `fix/auto-update-bug`
- **PR 머지 전 필수**: 빌드(`npm run build`) 와 타입체크(`npx tsc --noEmit`) 통과.
- **금지**: `master` / `main` 직접 푸시, force push, `--no-verify` 로 훅 우회.

# 위젯 버저닝 규칙

- **형식**: `년도.월.업데이트횟수` (예: `2026.5.1`, `2026.5.2`, `2026.6.1`)
  - `년도`: 4자리 (예: `2026`)
  - `월`: 1~12 (앞에 0 채우지 않음)
  - `업데이트횟수`: 해당 월의 N번째 업데이트. 1부터 시작.
- **증가 규칙**:
  - 같은 달 안에서 위젯이 업데이트될 때마다 `업데이트횟수`를 1씩 증가시킨다.
  - 달이 바뀌면 `년도.월` 을 현재 시점으로 갱신하고 `업데이트횟수`를 다시 `1` 부터 시작한다.
- 위젯별로 버전은 독립적으로 관리한다.

# Electron 위젯 창 포커스 정책 (중요)

배포 모드(`!isDev`)의 위젯 창은 **절대 포커스를 잡지 못하게** 만들어져 있다.
"항상 다른 창 뒤로 가려져 있어야 한다" 는 제품 요구사항 때문이다.

- `electron/widget-window.ts` — `focusable: APP_CONFIG.isDev` 로 배포 시 `focusable:false`
- `electron/widget-window.ts` — `win.on("focus", () => win.blur())` 핸들러로 포커스가 잠시 잡혀도 즉시 해제
- 토글 스위치는 `electron/config.ts` 의 `windowBehavior.stayInBackground = !isDev`

**부작용**: 윈도우 포커스가 필요한 모든 native UI 가 망가진다.
- `<select>` 드롭다운 popup 이 열렸다가 즉시 닫힘 → 선택 불가
- `<input>` 의 한글 IME, 컨텍스트 메뉴, 키보드 입력 전부 영향
- 단순 click 핸들러(버튼 등)는 영향 없음 — 포커스 안 받아도 click event 는 발화

**해결 패턴**: 사용자 입력이 필요한 패널이 열린 동안만 한시적으로 토글한다.

- `electron/widget-window.ts` 의 `setWidgetInteractive(win, value)` 를 사용
- 렌더러에서는 `window.epl.setFocusable(true)` / `setFocusable(false)`
- 패널 컴포넌트의 `useEffect` mount/unmount 에서 호출 (참고: `src/components/fortune/FortunePanel.tsx`)

**새로 native input 을 쓰는 패널을 만들 때 체크리스트**:
1. 컴포넌트 mount 시 `window.epl?.setFocusable?.(true)` 호출
2. cleanup 에서 `setFocusable(false)` 로 원복
3. dev 모드는 이미 focusable 이라 no-op — 따로 분기 안 해도 됨
4. 가능하면 native `<select>` 대신 커스텀 드롭다운 컴포넌트도 검토 (focusable 정책 안 건드려도 됨)

# MCP 서버 협업 규칙

| 파일 | 용도 | git |
| --- | --- | --- |
| `.mcp.json` | 팀 공통 MCP 서버 | 커밋 |
| `.mcp.local.json` | 개인 MCP 오버라이드 | gitignore |
| `~/.claude.json` | 본인 글로벌 MCP (모든 프로젝트) | 저장소 밖 |
