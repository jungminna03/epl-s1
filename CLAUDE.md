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

- **커밋 메시지**: [Conventional Commits](https://www.conventionalcommits.org/) 형식. `<type>(<scope>): <설명>` (한글 OK)
  - 타입: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `style`, `perf`
  - 예: `feat(notice): 공지 자동 회전 기능 추가`, `fix(electron): 자동 업데이트 오류 수정`
- **브랜치 이름**: `<type>/<짧은-설명>` (kebab-case)
  - 예: `feat/notice-rotation`, `fix/auto-update-bug`
- **PR 머지 전 필수**: 빌드(`npm run build`) 와 타입체크(`npx tsc --noEmit`) 통과.
- **금지**: `master` / `main` 직접 푸시, force push, `--no-verify` 로 훅 우회.

# MCP 서버 협업 규칙

| 파일 | 용도 | git |
| --- | --- | --- |
| `.mcp.json` | 팀 공통 MCP 서버 | 커밋 |
| `.mcp.local.json` | 개인 MCP 오버라이드 | gitignore |
| `~/.claude.json` | 본인 글로벌 MCP (모든 프로젝트) | 저장소 밖 |
