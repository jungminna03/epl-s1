# Claude Code 팀 협업 셋업 가이드 (재사용 템플릿)

이 문서 한 장이면 **새 프로젝트**에 Claude Code 협업 환경을 같은 방식으로 깔 수 있다.
파일 하나 복사 + 프롬프트 한 번이면 끝.

---

## 1. 무엇을 만드는가

| 파일 | 역할 | git |
| --- | --- | --- |
| `CLAUDE.md` | 프로젝트 규칙 (문서 위치 / 플러그인 / 커밋 컨벤션 / MCP) | 커밋 |
| `.claude/settings.json` | 팀 공통 플러그인 + 권한 정책 | 커밋 |
| `.claude/settings.local.json.example` | 개인 플러그인 템플릿 (각자 복사해서 사용) | 커밋 |
| `.claude/settings.local.json` | 개인 플러그인 (직접 만든 후 본인 PC에서만 사용) | gitignore |
| `.mcp.json` | 팀 공통 MCP 서버 | 커밋 |
| `.mcp.local.json` | 개인 MCP 오버라이드 | gitignore |
| `.gitignore` | 위 개인 파일들 무시 규칙 추가 | 기존 파일 수정 |

추가로 CLAUDE.md 에 다음 룰들이 들어간다: 문서 위치 / 플러그인 협업 / 커밋 컨벤션 / MCP 협업 / **외부 의존성 통제(사전 승인 룰)**.

---

## 2. 자동 셋업 프롬프트 (Claude Code 에 그대로 붙여넣기)

> 새 프로젝트의 루트에서 Claude Code 를 켜고, 아래 프롬프트를 그대로 붙여 넣으면 됨.
> 단, 이 가이드 파일(`docs/guides/claude-code-collab-setup.md`)이 미리 그 프로젝트에 들어있어야 한다 — 통째로 복사해 두고 시작하라.

```
docs/guides/claude-code-collab-setup.md 의 절차를 그대로 적용해서 이 프로젝트에
Claude Code 팀 협업 셋업을 깔아줘. 다음 원칙을 지킬 것:

1. 기존에 같은 이름의 파일(CLAUDE.md, .gitignore 등)이 있으면 내용을 덮어쓰지 말고
   가이드의 해당 섹션만 추가/머지해라. 기존 룰은 보존.
2. 이 프로젝트의 스택(Next.js / Electron / Python / Go 등)을 package.json·README
   등으로 먼저 파악하고, settings.json 의 permissions.allow 에 그 스택의
   자주 쓰는 명령(`npm run *`, `npx tsc:*`, `pytest:*` 등)을 맞춰서 넣어라.
3. .claude/settings.json 의 enabledPlugins / extraKnownMarketplaces 와 .mcp.json 의
   mcpServers 는 빈 채로 둔다. 팀이 합의 후 PR 로 추가.
4. 끝나면 git status 로 변경 파일을 보여주고, 커밋은 사용자 확인 후에만.
```

이게 전부다. Claude 가 가이드를 읽고 알아서 처리한다.

---

## 3. 수동 셋업 (프롬프트가 안 통하는 경우)

### 3-1. `CLAUDE.md` 작성

루트에 `CLAUDE.md` 를 만들고 다음을 넣는다 (기존 파일이 있으면 섹션만 추가).

````markdown
# 문서 위치 규칙

- 모든 프로젝트 문서(스펙, 설계, 회의록, 분석, 가이드 등)는 **`docs/`** 폴더 아래에 둔다. 루트나 `src/` 에 흩뿌리지 말 것.
- 하위 분류 예: `docs/specs/`, `docs/design/`, `docs/guides/`.
- `README.md`, `CLAUDE.md` 처럼 도구가 루트에서 읽는 표준 파일만 예외다.

# Claude Code 플러그인 협업 규칙

| 파일 | 용도 | git |
| --- | --- | --- |
| `.claude/settings.json` | 팀 공통 플러그인 / 마켓플레이스 / 권한 | 커밋 |
| `.claude/settings.local.json` | 개인 플러그인 및 로컬 오버라이드 | gitignore |

- 팀 공통 플러그인은 `.claude/settings.json` 에 추가하고 PR 로 합의.
- 개인 플러그인은 `.claude/settings.local.json.example` 을 복사해서 사용. (gitignore)
- 키 우선순위: `settings.local.json` > `settings.json` > `~/.claude/settings.json`.

# 외부 의존성 통제 (사전 승인 룰)

- **금지**: `package.json` 의 `dependencies`/`devDependencies`/`optionalDependencies`/`peerDependencies` 를 임의 추가·변경.
- **허용**: 인자 없는 `npm install` / `npm ci` (lockfile 동기화).
- **새 패키지가 필요하면**: 문제·후보(1~3개, 크기/메인테넌스/라이선스)·자체 구현 대안·추천+이유 를 사용자에게 제시. 명시 승인 후에만 설치.
- `.claude/settings.json` 의 `permissions.deny` 가 권한 단에서도 한 번 더 차단함.

# 커밋 / 브랜치 컨벤션

- **커밋 메시지**: `[TAG] 한국어 설명` 형식. 한 커밋엔 태그 하나만.
  - 태그: `[ADD]`, `[FIX]`, `[UPDATE]`, `[REFACTOR]`, `[REMOVE]`, `[STYLE]`, `[DOCS]`, `[CHORE]`, `[TEST]`, `[BUILD]`, `[CI]`, `[PERF]`
  - 예: `[ADD] 공지 자동 회전 기능`, `[FIX] 자동 업데이트 다운로드 오류`
- **브랜치 이름**: `<type>/<짧은-설명>` (kebab-case, 영문)
  - 타입: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `style`, `perf`
- **PR 머지 전**: 빌드/타입체크 통과.
- **금지**: `master`/`main` 직접 푸시, force push, `--no-verify` 훅 우회.

# MCP 서버 협업 규칙

| 파일 | 용도 | git |
| --- | --- | --- |
| `.mcp.json` | 팀 공통 MCP 서버 | 커밋 |
| `.mcp.local.json` | 개인 MCP 오버라이드 | gitignore |
| `~/.claude.json` | 본인 글로벌 MCP | 저장소 밖 |
````

### 3-2. `.claude/settings.json` (팀 공통)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "_comment": "팀 공통 Claude Code 설정. 개인 플러그인/오버라이드는 .claude/settings.local.json 에 작성.",

  "extraKnownMarketplaces": {},
  "enabledPlugins": {},

  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git branch:*)",
      "Bash(git show:*)",
      "Bash(git fetch:*)",
      "Bash(git stash:*)",
      "Bash(git restore:*)",
      "Bash(git switch:*)",
      "Bash(git checkout:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git rm:*)",
      "Bash(npm install)",
      "Bash(npm ci)",
      "Bash(npm run *)",
      "Bash(npm test)",
      "Bash(npx tsc:*)",
      "Bash(npx eslint:*)",
      "Bash(npx prettier:*)"
    ],
    "deny": [
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(git push --force-with-lease origin master:*)",
      "Bash(git push --force-with-lease origin main:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean -fdx:*)",
      "Bash(git branch -D *)",
      "Bash(npm install *)",
      "Bash(npm i *)",
      "Bash(npm add *)",
      "Bash(npm uninstall *)",
      "Bash(npm remove *)",
      "Bash(yarn add *)",
      "Bash(yarn remove *)",
      "Bash(pnpm add *)",
      "Bash(pnpm remove *)",
      "Bash(bun add *)",
      "Bash(bun remove *)"
    ]
  }
}
```

> **외부 의존성 통제**
> 위 deny 패턴은 인자 있는 `npm install <pkg>` / `npm add` / `yarn add` / `pnpm add` / `bun add` 를 모두 차단한다. 인자 없는 `npm install` / `npm ci` 는 allow 유지(lockfile 동기화용). 새 패키지 추가는 사용자 승인 뒤에 직접 수행. CLAUDE.md 에 같은 룰을 본문으로도 박아 둘 것.

> **플러그인 등록 형식** (`enabledPlugins`)
> ```json
> "enabledPlugins": {
>   "superpowers@claude-plugins-official": true,
>   "my-plugin@my-marketplace": true
> }
> ```
> `claude-plugins-official` 은 Claude Code 빌트인 마켓플레이스라 `extraKnownMarketplaces` 에 추가할 필요 없음. 사설 마켓플레이스는 `extraKnownMarketplaces` 에 source 정의 후 enable.

> **스택별 권한 추가 예시**
> - Next.js: `"Bash(npx next:*)"`
> - Python: `"Bash(pytest:*)"`, `"Bash(python -m *)"`, `"Bash(ruff:*)"`
> - Go: `"Bash(go build:*)"`, `"Bash(go test:*)"`, `"Bash(go run:*)"`
> - Rust: `"Bash(cargo build:*)"`, `"Bash(cargo test:*)"`

### 3-3. `.claude/settings.local.json.example` (개인 템플릿)

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "_comment": "이 파일은 템플릿입니다. 'settings.local.json' 으로 복사한 뒤 본인 플러그인/마켓플레이스만 추가하세요. settings.local.json 은 gitignore 됩니다.",

  "_example_extraKnownMarketplaces": {
    "my-marketplace": {
      "source": { "source": "github", "repo": "your-org/your-plugins" }
    }
  },
  "_example_enabledPlugins": ["my-tool@my-marketplace"],

  "extraKnownMarketplaces": {},
  "enabledPlugins": []
}
```

### 3-4. `.mcp.json` (팀 공통 MCP)

```json
{
  "$schema": "https://json.schemastore.org/mcp.json",
  "_comment": "팀 공통 MCP 서버. 개인 MCP 는 ~/.claude.json (글로벌) 또는 .mcp.local.json (gitignore) 에 작성.",
  "mcpServers": {}
}
```

### 3-5. `.gitignore` 추가 (기존 파일에 append)

```
# Claude Code - 개인 설정/상태는 무시, 팀 공통 settings.json 은 커밋
.claude/settings.local.json
.claude/state.json
.claude/projects/
.claude/cache/
.claude/history.jsonl

# 개인 MCP 서버 설정
.mcp.local.json
```

> Next.js 프로젝트라면 `AGENTS.md` 도 추가 (postinstall 때 자동 생성됨, CLAUDE.md 와 중복 방지).

---

## 4. 팀원 온보딩 절차

`git clone` 후:

1. **공통 플러그인** → 자동. Claude Code 켜는 순간 `.claude/settings.json` 의 `enabledPlugins` 가 동작.
2. **개인 플러그인이 글로벌(`~/.claude/`) 에 있다면** → 아무것도 안 해도 됨.
3. **이 프로젝트에서만 켤 개인 플러그인이 있다면** → `cp .claude/settings.local.json.example .claude/settings.local.json` 후 편집.

---

## 5. 다른 프로젝트에 옮기는 가장 빠른 절차

```bash
# 1. 새 프로젝트 루트에서
mkdir -p docs/guides
cp <원본>/docs/guides/claude-code-collab-setup.md docs/guides/

# 2. Claude Code 켜고 위 §2 의 프롬프트 붙여넣기
```

가이드 자체는 어떤 스택에도 의존하지 않게 작성됐다. 스택별 권한만 §3-2 의 예시를 참고해서 추가하면 된다.
