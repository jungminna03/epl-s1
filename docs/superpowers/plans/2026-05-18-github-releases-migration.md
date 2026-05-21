# GitHub Releases 이전 — 자동 업데이트 호스팅 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동 업데이트 인프라(매니페스트/인스톨러/위젯 설정 호스팅)를 Vercel Blob 에서 GitHub Releases + raw 파일로 이전. 기존 100대 PC 는 6/1 한도 리셋 시 widget-config.json 한 번 갱신으로 자동 마이그레이션.

**Architecture:** `electron-updater` 의 `generic` provider 를 그대로 유지하고 URL 만 GitHub 의 `releases/latest/download/` 패턴으로 변경. `bootstrapUrl` 은 `raw.githubusercontent.com` 의 `main` 브랜치 파일을 가리키게 함. `release.mjs` 의 `@vercel/blob` 업로드 블록을 `gh release create/upload --clobber` 호출로 교체. 기존 Blob 인프라는 자연 사망까지 손대지 않음.

**Tech Stack:** Electron 42, electron-builder 26, electron-updater 6, Node.js (release.mjs), `gh` CLI, GitHub Releases.

**Spec:** `docs/superpowers/specs/2026-05-18-github-releases-migration-design.md`

---

## File Structure

| 파일 | 책임 | 변경 종류 |
|---|---|---|
| `widget-config.json` | 런타임 설정 (위젯 부트스트랩이 fetch) | Modify — `updateFeedUrl` 만 |
| `electron/config.ts` | 인스톨러에 박히는 상수 (`bootstrapUrl`, `updateFeedUrl`) | Modify — 두 URL |
| `electron/bootstrap.ts` | 부트스트랩 fetch 실패 시 fallback DEFAULT_CONFIG | Modify — `DEFAULT_CONFIG.updateFeedUrl` |
| `electron-builder.yml` | 빌드 시 latest.yml 생성용 publish URL | Modify — `publish[0].url` |
| `scripts/release.mjs` | 빌드 후 자산 업로드 자동화 | Modify — Blob put 블록 → `gh release` 호출 |
| `electron/updater.ts` | electron-updater 셋업 | **변경 없음** (참조만) |

`@vercel/blob` 의존성은 `package.json` 에 그대로 둔다. CLAUDE.md 의 외부 의존성 통제 룰("dependencies/devDependencies 추가·변경 금지") 적용 — `release.mjs` 가 더 이상 import 하지 않아도 패키지 자체는 일단 둠. 별도 정리 PR 에서 사용자 승인 후 제거.

## Pre-flight (수동 사전 작업)

- [ ] **Step P1: GitHub repo 를 public 으로 전환**
  - 브라우저로 https://github.com/jungminna03/epl-s1/settings 열기
  - "Danger Zone" → "Change repository visibility" → "Make public" 클릭
  - 저장소 이름 확인 입력 후 확정

- [ ] **Step P2: gh CLI 인증 확인**

Run: `gh auth status`

Expected: `Logged in to github.com account jungminna03` 표시 + 스코프에 `repo` 포함

- [ ] **Step P3: 빌드 환경 결정 (Windows 타깃)**

`electron-builder --win` 은 macOS 에서 wine 필요. macOS Tahoe (15.x) 에서 `wine-stable` cask 가 deprecated (2026-09-01 비활성화 예정) + Gatekeeper 차단 + Rosetta 2 + sudo 비밀번호 등으로 로컬 빌드 길이 막힘.

→ **이 plan 은 GitHub Actions Windows runner 빌드를 채택.** public repo 라 무제한 무료, native Windows 라 wine 불필요. 자세한 셋업은 Task 4 에서.

---

### Task 1: widget-config.json + 인스톨러 박힌 URL 들을 GitHub 으로 갱신

**Files:**
- Modify: `widget-config.json`
- Modify: `electron/config.ts:14-16,55-56`
- Modify: `electron/bootstrap.ts:52`
- Modify: `electron-builder.yml:46-49`

- [ ] **Step 1: widget-config.json 의 updateFeedUrl 변경**

`widget-config.json` 의 `updateFeedUrl` 한 줄을 교체:

```diff
-  "updateFeedUrl": "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com",
+  "updateFeedUrl": "https://github.com/jungminna03/epl-s1/releases/latest/download",
```

- [ ] **Step 2: electron/config.ts 의 bootstrapUrl + updateFeedUrl 변경**

`electron/config.ts` 14-16 라인 (updateFeedUrl + 주석) 교체:

```ts
  /** 자동 업데이트 매니페스트 호스트 (electron-updater generic provider).
   *  GitHub Releases — public repo asset 은 인증 X, 다운로드 무제한 무료. */
  updateFeedUrl: "https://github.com/jungminna03/epl-s1/releases/latest/download",
```

같은 파일 55-56 라인 (bootstrapUrl) 교체:

```ts
  /** 부트스트랩 URL — main 브랜치 raw 파일. 캐시 5분, 폴링 30분과 잘 맞음. */
  bootstrapUrl:
    "https://raw.githubusercontent.com/jungminna03/epl-s1/main/widget-config.json",
```

- [ ] **Step 3: electron/bootstrap.ts 의 DEFAULT_CONFIG.updateFeedUrl 변경**

`electron/bootstrap.ts` 52 라인 교체:

```diff
-  updateFeedUrl: "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com",
+  updateFeedUrl: "https://github.com/jungminna03/epl-s1/releases/latest/download",
```

- [ ] **Step 4: electron-builder.yml 의 publish URL 변경**

`electron-builder.yml` 44-49 라인 교체:

```yaml
# 자동 업데이트 — GitHub Releases (public repo, 무료, 무제한 다운로드).
# generic provider 유지 — releases/latest/download URL 이 정적 파일 서버 패턴 그대로 동작.
publish:
  - provider: generic
    url: https://github.com/jungminna03/epl-s1/releases/latest/download
    channel: latest
```

- [ ] **Step 5: TypeScript 컴파일 통과 확인**

Run: `npx tsc -p electron/tsconfig.json --noEmit && npx tsc --noEmit`

Expected: 에러 없음 (exit 0)

- [ ] **Step 6: Next.js 빌드 통과 확인**

Run: `npm run build`

Expected: "Compiled successfully" + 에러 없음

- [ ] **Step 7: Commit**

```bash
git add widget-config.json electron/config.ts electron/bootstrap.ts electron-builder.yml
git commit -m "$(cat <<'EOF'
[UPDATE] 자동 업데이트/부트스트랩 URL 을 GitHub 으로 이전

Vercel Blob 무료 한도 초과로 호스팅 GitHub Releases + raw 파일로 변경.
- bootstrapUrl: raw.githubusercontent.com/.../main/widget-config.json
- updateFeedUrl: github.com/.../releases/latest/download
electron-updater generic provider 그대로 유지 — URL 만 바뀜.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: scripts/release.mjs 의 Blob 업로드 → gh release 로 교체

**Files:**
- Modify: `scripts/release.mjs` (전면 개편)

- [ ] **Step 1: scripts/release.mjs 를 새 내용으로 교체**

전체 파일을 다음으로 덮어쓰기:

```js
#!/usr/bin/env node
/**
 * EPL 위젯 릴리즈 — 빌드 → GitHub Release 업로드 → Vercel 웹 배포.
 *
 * 사용법:
 *   1) package.json 의 version 을 올린다 (수동 또는 npm version)
 *   2) gh CLI 가 인증되어 있어야 함 (gh auth status 로 확인)
 *   3) npm run release
 *
 * 동작:
 *   - electron:release → release/EPL-공지사항-Setup-x.y.z.exe + latest.yml 생성
 *   - 산출물 3종(latest.yml, *.exe, *.exe.blockmap)을 GitHub Release 의 v<version>
 *     태그에 업로드. 같은 태그 재실행 시 --clobber 로 덮어씀.
 *   - vercel --prod 호출 → /display 페이지 등 웹 콘텐츠 배포.
 *
 * 결과:
 *   - 학교 PC 들은 30분 이내에 GitHub 의 latest.yml 폴링 → 새 버전 발견 →
 *     백그라운드 다운로드 → 다음 종료 시 자동 설치.
 *   - widget-config.json 은 별도 (main 브랜치 raw 파일).
 *     변경 시 git commit/push 로 갱신 — 이 스크립트는 안 만짐.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE_DIR = join(ROOT, "release");
const PKG_PATH = join(ROOT, "package.json");

const OWNER_REPO = "jungminna03/epl-s1";

function run(cmd, args, opts = {}) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: ROOT,
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.status !== 0) {
    console.error(`✖ ${cmd} 실패 (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

function ghReleaseExists(tag) {
  const r = spawnSync("gh", ["release", "view", tag, "--repo", OWNER_REPO], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return r.status === 0;
}

console.log("=== EPL 위젯 릴리즈 (GitHub Releases) ===");

// 0) gh 인증 확인
{
  const r = spawnSync("gh", ["auth", "status"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    console.error("✖ gh CLI 인증 실패. `gh auth login` 후 다시 시도.");
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
}

// 1) package.json 에서 버전 읽기
const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const VERSION = pkg.version;
const TAG = `v${VERSION}`;
console.log(`▶ 버전: ${VERSION} (태그 ${TAG})`);

// 2) 빌드
run("npm", ["run", "electron:release"]);

if (!existsSync(RELEASE_DIR)) {
  console.error("release/ 가 없습니다 — 빌드 산출물을 찾을 수 없음.");
  process.exit(1);
}

// 3) 업로드 대상 추리기 — electron-updater 가 인식하는 자산만
const KEEP = /\.(exe|exe\.blockmap|yml)$/i;
const targets = readdirSync(RELEASE_DIR)
  .filter((f) => KEEP.test(f) && f !== "builder-debug.yml")
  .map((f) => join(RELEASE_DIR, f));

if (targets.length === 0) {
  console.error("업로드할 산출물이 없습니다.");
  process.exit(1);
}

console.log(`\n▶ 업로드 대상 (${targets.length}개):`);
for (const p of targets) {
  const stat = readFileSync(p);
  console.log(`  • ${p.split("/").pop()} (${(stat.length / 1024 / 1024).toFixed(1)} MB)`);
}

// 4) GitHub Release 생성 (없으면) 또는 자산만 덮어쓰기 (있으면)
if (!ghReleaseExists(TAG)) {
  console.log(`\n▶ GitHub Release ${TAG} 생성`);
  run("gh", [
    "release",
    "create",
    TAG,
    "--repo", OWNER_REPO,
    "--title", TAG,
    "--notes", `EPL 위젯 ${VERSION}`,
    "--latest",
    ...targets,
  ]);
} else {
  console.log(`\n▶ GitHub Release ${TAG} 존재 — 자산 덮어쓰기`);
  run("gh", [
    "release",
    "upload",
    TAG,
    "--repo", OWNER_REPO,
    "--clobber",
    ...targets,
  ]);
}

// 5) Vercel 웹 배포 (위젯 페이지/display)
console.log("\n▶ Vercel 웹 배포 (vercel --prod)");
run("npx", ["vercel", "--prod", "--yes"]);

console.log("\n✓ 완료.");
console.log(`   매니페스트: https://github.com/${OWNER_REPO}/releases/latest/download/latest.yml`);
console.log(`   부트스트랩: https://raw.githubusercontent.com/${OWNER_REPO}/main/widget-config.json`);
console.log(`   웹: https://epl-s1.vercel.app/display`);
```

- [ ] **Step 2: Node 문법 체크 (실행 전 정적 확인)**

Run: `node --check scripts/release.mjs`

Expected: 출력 없음 (exit 0)

- [ ] **Step 3: gh CLI 정상 작동 확인 (dry-run)**

Run: `gh release list --repo jungminna03/epl-s1 --limit 5`

Expected: 빈 출력 또는 release 목록. 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add scripts/release.mjs
git commit -m "$(cat <<'EOF'
[REFACTOR] release 스크립트의 Blob 업로드를 gh release 호출로 교체

@vercel/blob put → gh release create/upload --clobber.
BLOB_READ_WRITE_TOKEN 의존성 제거.
같은 버전 재배포 시 --clobber 로 자산만 덮어씀.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: main 브랜치 초기화 — README + widget-config.json 푸시

**Files:**
- 새 GitHub repo (`jungminna03/epl-s1`) 의 빈 main 브랜치에 두 파일 푸시

⚠️ **주의**: 이 Task 는 본 저장소(`git.rehomik.synology.me`)와 별개. **새 임시 디렉토리**에서 작업하여 origin 잘못 푸시하는 사고 방지.

- [ ] **Step 1: 임시 작업 디렉토리 생성**

Run:
```bash
mkdir -p /tmp/epl-s1-gh-mirror && cd /tmp/epl-s1-gh-mirror && git init -b main
```

Expected: `/tmp/epl-s1-gh-mirror` 에 빈 git repo. 기본 브랜치 `main`.

- [ ] **Step 2: 현재 저장소의 widget-config.json 을 복사**

Run:
```bash
cp /Users/nyxrux62/Documents/GitHub/epl-s1/widget-config.json /tmp/epl-s1-gh-mirror/widget-config.json
```

- [ ] **Step 3: README.md 작성**

`/tmp/epl-s1-gh-mirror/README.md` 에 다음 내용:

```markdown
# EPL 위젯 — 릴리즈 호스팅

이 저장소는 EPL 캠퍼스 공지사항 데스크톱 위젯의 **자동 업데이트 배포** 전용입니다.
본체 코드는 별도 저장소 (Synology Git) 에서 관리됩니다.

## 호스팅하는 것

- `widget-config.json` (main 브랜치 raw 파일) — 위젯이 부팅 시 fetch 하는 런타임 설정.
  변경: `git push` 한 번이면 5분 안에 학교 PC 들이 받음.
- Releases — 인스톨러 / latest.yml / blockmap. electron-updater 가 30분 주기로 폴링.

## 자동 업데이트 URL

- 매니페스트: https://github.com/jungminna03/epl-s1/releases/latest/download/latest.yml
- 부트스트랩: https://raw.githubusercontent.com/jungminna03/epl-s1/main/widget-config.json
```

- [ ] **Step 4: origin 셋업 + 푸시**

Run:
```bash
cd /tmp/epl-s1-gh-mirror
git add README.md widget-config.json
git -c user.email=jungminna03@gmail.com -c user.name=jungminna03 commit -m "Initial commit — widget-config + README"
git remote add origin https://github.com/jungminna03/epl-s1.git
git push -u origin main
```

Expected: 푸시 성공. GitHub repo 의 default branch 가 `main` 으로 설정됨.

- [ ] **Step 5: raw 파일 접근 확인 (캐시 워밍)**

Run: `curl -sI "https://raw.githubusercontent.com/jungminna03/epl-s1/main/widget-config.json"`

Expected: `HTTP/2 200`. `content-type: text/plain` 또는 `application/json`.

(첫 요청 후 1-2분 정도 지연될 수 있음 — 그러면 다시 시도)

- [ ] **Step 6: 임시 디렉토리 cleanup (선택)**

Run: `rm -rf /tmp/epl-s1-gh-mirror`

---

### Task 4: GitHub Actions Windows runner 워크플로우 셋업 + 첫 release 트리거

**왜 GitHub Actions:** macOS 에서 wine 길이 막힘 (deprecated + sudo). public repo 라 Actions 무제한 무료, Windows runner 면 native 빌드라 wine 불필요.

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `scripts/release.mjs` (간소화 — tag push 만)
- Modify: `package.json` (version 필드만)

#### Step 1: `.github/workflows/release.yml` 작성

```yaml
name: Build & Release

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:
    inputs:
      tag:
        description: "Release 태그 (예: v0.2.1). 비우면 푸시된 태그 사용."
        required: false

permissions:
  contents: write

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install deps
        run: npm ci

      - name: Build electron-builder (Windows)
        run: npm run electron:tsc && npx electron-builder --win --publish never

      - name: Resolve tag
        id: tag
        shell: bash
        run: |
          if [ -n "${{ github.event.inputs.tag }}" ]; then
            echo "tag=${{ github.event.inputs.tag }}" >> "$GITHUB_OUTPUT"
          else
            echo "tag=${GITHUB_REF##*/}" >> "$GITHUB_OUTPUT"
          fi

      - name: Upload to GitHub Release (create or clobber)
        env:
          GH_TOKEN: ${{ github.token }}
        shell: bash
        run: |
          TAG="${{ steps.tag.outputs.tag }}"
          ASSETS=$(ls release/*.exe release/*.exe.blockmap release/latest.yml 2>/dev/null)
          if ! gh release view "$TAG" --repo "${{ github.repository }}" >/dev/null 2>&1; then
            gh release create "$TAG" --repo "${{ github.repository }}" --title "$TAG" --notes "EPL 위젯 $TAG" --latest $ASSETS
          else
            gh release upload "$TAG" --repo "${{ github.repository }}" --clobber $ASSETS
          fi
```

#### Step 2: `scripts/release.mjs` 간소화

기존 빌드+업로드 로직 제거. tag push 만 함.

```js
#!/usr/bin/env node
/**
 * EPL 위젯 릴리즈 — GitHub Actions workflow 트리거.
 *
 * 사용법:
 *   1) package.json 의 version 을 올린다 (npm version patch --no-git-tag-version)
 *   2) commit 후
 *   3) npm run release  →  git tag v<version> + git push origin v<version>
 *   4) .github/workflows/release.yml 이 자동으로 Windows runner 에서 빌드 + release 생성/갱신
 *
 * 운영:
 *   - 같은 버전 재실행: tag 가 이미 있으면 push 단계에서 거부됨.
 *     로컬에서 git tag -d v<version> + git push origin :refs/tags/v<version> 으로 정리 후 재시도.
 *   - 진행 상황: gh run watch 또는 GitHub Actions 탭.
 */

import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";

const ROOT = resolve(import.meta.dirname, "..");
const PKG_PATH = join(ROOT, "package.json");
const OWNER_REPO = "jungminna03/epl-s1";

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: ROOT,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`✖ ${cmd} 실패 (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

console.log("=== EPL 위젯 릴리즈 (GitHub Actions 트리거) ===");

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const VERSION = pkg.version;
const TAG = `v${VERSION}`;
console.log(`▶ 버전: ${VERSION} (태그 ${TAG})`);

// 1) 로컬 tag 생성 (이미 있으면 git 이 거부 — 사용자가 정리해야 함)
run("git", ["tag", TAG]);

// 2) origin 으로 tag push → workflow 트리거
run("git", ["push", "origin", TAG]);

console.log("\n✓ 트리거 완료.");
console.log(`   Actions: https://github.com/${OWNER_REPO}/actions`);
console.log(`   Release (빌드 끝나면): https://github.com/${OWNER_REPO}/releases/tag/${TAG}`);
console.log(`   진행 상황 보기: gh run watch --repo ${OWNER_REPO}`);
```

#### Step 3: 버전 bump + commit + workflow + release.mjs 변경 한 번에 커밋

```bash
npm version patch --no-git-tag-version  # 0.2.0 → 0.2.1
git add .github/workflows/release.yml scripts/release.mjs package.json
git commit -m "$(cat <<'EOF'
[BUILD] GitHub Actions Windows runner 로 release 빌드 이전

macOS 의 wine-stable 이 deprecated + Gatekeeper 차단 + sudo 의존성으로 로컬 빌드 길 막힘.
대신 .github/workflows/release.yml 추가 — public repo Actions 무제한 무료, Windows runner 면 wine 불필요.
release.mjs 는 git tag push 만 하는 트리거 스크립트로 간소화.
버전 0.2.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

#### Step 4: 코드 push (main 아님 — 현재 브랜치)

```bash
git push -u origin chore/github-releases-migration
```

⚠️ 이건 작업 브랜치 push. **workflow 는 아직 트리거 안 됨** (tag push 가 트리거).

⚠️ jungminna03/epl-s1 의 **main 에 워크플로우 파일이 있어야** Actions 가 동작. main 에 머지 또는 cherry-pick 필요.

#### Step 5: workflow 파일을 main 에 반영

GitHub Actions 는 default branch (main) 의 workflow 정의를 따른다. 현재 main 에는 README + widget-config.json 만 있고 workflow 가 없음.

옵션 A — cherry-pick:
```bash
# 임시 디렉토리 clone
cd /tmp && git clone https://github.com/jungminna03/epl-s1.git epl-s1-main-update
cd epl-s1-main-update
# release.yml 만 복사
mkdir -p .github/workflows
cp /Users/nyxrux62/Documents/GitHub/epl-s1/.github/workflows/release.yml .github/workflows/release.yml
git add .github/workflows/release.yml
git -c user.email=jungminna03@gmail.com -c user.name=jungminna03 commit -m "Add release workflow (Windows runner)"
git push origin main
cd -
```

옵션 B — 동시에 같은 commit 의 source 코드도 main 으로? 안 함. main 은 release 호스팅 전용. workflow 만 추가.

#### Step 6: 첫 release 트리거

본 저장소(chore/github-releases-migration 브랜치)에서:

```bash
npm run release
```

내부적으로 `git tag v0.2.1 && git push origin v0.2.1`. push 와 함께 GitHub Actions 의 workflow 가 트리거됨.

⚠️ workflow 가 checkout 하는 코드는 **tag 가 가리키는 commit** 의 트리. 즉 chore/github-releases-migration 의 현재 코드가 들어감. main 에는 워크플로우만 있으면 충분.

#### Step 7: 빌드 진행 모니터링

```bash
gh run watch --repo jungminna03/epl-s1
```

또는 https://github.com/jungminna03/epl-s1/actions

Expected: ~5-10분 후 release 생성/자산 업로드 성공.

#### Step 8: GitHub Releases 페이지 확인

브라우저: https://github.com/jungminna03/epl-s1/releases/tag/v0.2.1

Expected: `latest.yml`, `EPL-공지사항-Setup-0.2.1.exe`, `EPL-공지사항-Setup-0.2.1.exe.blockmap` 3개 자산 첨부됨. "Latest" 배지 붙음.

#### Step 9: latest.yml 외부 접근 검증

```bash
curl -s "https://github.com/jungminna03/epl-s1/releases/latest/download/latest.yml" | head -20
```

Expected: yml 본문 — `version: 0.2.1`, `files:` 아래 `url: EPL-공지사항-Setup-0.2.1.exe`, `sha512: ...` 등.

#### Step 10: 인스톨러 자산 헤더 확인 (Content-Length)

```bash
curl -sIL -o /dev/null -w "%{http_code} size=%{size_download} ctype=%{content_type}\n" \
  "https://github.com/jungminna03/epl-s1/releases/latest/download/EPL-공지사항-Setup-0.2.1.exe"
```

Expected: 최종 응답 `200`, `size=` 약 156MB, `ctype=application/octet-stream`.

---

### Task 5: 새 인스톨러 동작 검증 (수동, Windows)

이 Task 는 **실제 Windows 머신** (또는 VM) 에서 수행. 자동화 불가.

**Files:** 없음 — 수동 검증.

- [ ] **Step 1: 인스톨러 다운로드 및 설치**

Windows 머신에서:
```
https://github.com/jungminna03/epl-s1/releases/latest/download/EPL-공지사항-Setup-0.2.1.exe
```
다운로드 후 실행. 설치 완료까지 진행.

Expected: NSIS 인스톨러가 무사히 끝남. "EPL 공지사항" 위젯이 우하단에 등장.

- [ ] **Step 2: 업데이터 로그 확인**

Windows 의 로그 위치:
```
%APPDATA%\EPL 공지사항\logs\main.log
```

(또는 `electron-log` 기본 경로)

이 파일에서 다음 라인 확인:
```
[updater] dev 모드 — 자동 업데이트 비활성화
```
는 안 나와야 함 (prod 빌드).

대신:
```
checking-for-update
update-not-available  (또는 update-available)
```
이 나와야 함. 그리고 위 줄 위에 setFeedURL 의 URL 이 `github.com/jungminna03/epl-s1/releases/latest/download` 로 찍혀 있어야 함.

- [ ] **Step 3: 부트스트랩 fetch 확인**

같은 로그 파일에서:
```
[bootstrap] 원격 config 로드 성공
```

이 나와야 함 (raw.githubusercontent.com 에서 widget-config.json 받았다는 뜻).

만약 `[bootstrap] 원격 fetch 실패` 가 나오면 → Task 3 의 main 브랜치 푸시가 잘못된 것. raw URL 다시 확인.

---

### Task 6 (6/1 운영 단계): 100대 PC 마이그레이션 트리거

⚠️ **이 Task 는 6/1 이후 실행.** 그 전까지는 대기.

**Files:** 없음 — Vercel 대시보드 수동 작업.

- [ ] **Step 1: Blob 한도 리셋 확인**

Run (6/1 00:00 이후):
```bash
curl -sI "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json"
```

Expected: `HTTP/2 200`. 본문도 받아짐.

만약 여전히 `Your store is blocked` → 한도 리셋 이슈가 아님. 영구 잠김 가능. Fallback Task 7 로.

- [ ] **Step 2: 현재 Blob 의 widget-config.json 내용 백업**

Run:
```bash
curl -s "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json" > /tmp/widget-config-blob-backup.json
cat /tmp/widget-config-blob-backup.json
```

- [ ] **Step 3: 새 widget-config.json 준비**

내용은 현재 저장소 `widget-config.json` 과 동일하면 됨 (`updateFeedUrl` 이 GitHub 가리킴):

```bash
cat /Users/nyxrux62/Documents/GitHub/epl-s1/widget-config.json
```

- [ ] **Step 4: Vercel 대시보드에서 Blob 파일 교체**

브라우저:
1. https://vercel.com 로그인
2. Storage 탭 → epl-s1 (또는 해당 Blob store) 선택
3. `widget-config.json` 파일 찾기 → "Replace" 또는 삭제 후 새로 업로드
4. 새 파일 업로드 (위 Step 3 의 내용)

- [ ] **Step 5: 교체 확인**

Run:
```bash
curl -s "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json" | grep updateFeedUrl
```

Expected: `"updateFeedUrl": "https://github.com/jungminna03/epl-s1/releases/latest/download",`

- [ ] **Step 6: 마이그레이션 진행 모니터링 (30분 ~ 24시간)**

학교 PC 들이 30분 폴링 주기로 새 설정을 받음. 그 후 다음 자동 업데이트 폴링(역시 30분 주기) 에 GitHub release 발견. 다운로드 → 다음 PC 재시작 시 설치.

검증 가능한 지표:
- GitHub Releases 페이지의 다운로드 카운트 증가 (Insights → Traffic, 또는 release 페이지 자산 옆 숫자)
- 학교 PC 한 대 골라서 원격 접속 → 로그 확인

---

### Task 7 (Fallback, Blob 영구 잠김 시): 수동 재설치

⚠️ Task 6 의 Step 1 에서 Blob 이 여전히 잠긴 경우.

**Files:** 없음 — 운영자가 학교 방문하여 수동 진행.

- [ ] **Step 1: 학교 PC 들 목록 확보 + 방문 일정 잡기**

- [ ] **Step 2: 각 PC 에서 기존 위젯 제거**

Windows 제어판 → 프로그램 추가/제거 → "EPL 공지사항" 제거.
또는 `%APPDATA%\EPL 공지사항\Uninstall *.exe` 실행.

- [ ] **Step 3: 새 인스톨러 설치**

USB 또는 네트워크 공유로 `EPL-공지사항-Setup-0.2.1.exe` 배포 후 실행.

- [ ] **Step 4: 한 대당 동작 확인**

위젯 우하단 등장 + 로그에 `[bootstrap] 원격 config 로드 성공` 확인.

---

## Self-Review

### Spec 커버리지

- ✅ "GitHub Releases public + raw widget-config.json 호스팅" — Task 1, 3
- ✅ "generic provider 유지" — Task 1 Step 4 (electron-builder.yml `provider: generic` 유지)
- ✅ "코드 변경 4 파일" — Task 1, 2
- ✅ "듀얼 트랙 — Blob 손대지 않음" — Pre-flight 부터 Task 5 까지 Blob 미접근
- ✅ "6/1 마이그레이션 트리거" — Task 6
- ✅ "Fallback (수동 재설치)" — Task 7
- ✅ "신규 PC 는 Track B" — Task 4-5 결과물이 그 인스톨러

### 위험/엣지 케이스

- ✅ macOS 에서 `electron-builder --win` 실패 가능성 → Pre-flight P3 으로 사전 차단
- ✅ 같은 버전 재배포 시 → `gh release upload --clobber` 자동 처리 (release.mjs Step 1 코드)
- ✅ widget-config.json 의 `updateFeedUrl` 누락 → Task 1 Step 1 에서 검증

### 누락 검증

- 자동 업데이트가 정상 다운로드되는지 (인스톨러 156MB) — Task 4 Step 7 (Content-Length 확인) + Task 5 Step 2 (실 머신 로그)
- 부트스트랩 fetch 가 정상 — Task 5 Step 3

---

## 운영 메모

- `@vercel/blob` 의존성은 `package.json` 에 남아있음. 별도 정리 PR 에서 사용자 승인 후 `npm uninstall @vercel/blob`. CLAUDE.md 룰에 따라 이 plan 에선 건드리지 않음.
- `widget-config.json` 갱신 시 (예: 킬스위치 발동) `git push` 후 5분 ~ 폴링 주기(30분) 안에 학교 PC 들이 받음. 빠른 반영이 필요하면 raw URL 의 캐시 우회는 안 됨 (GitHub raw 의 `Cache-Control: max-age=300` 고정).
- 향후 `widget-config.json` 만 단독 커밋하면 Task 3 같은 별도 mirror 디렉토리 필요 없음 — main 브랜치 체크아웃하면 됨. 본 저장소(Synology) 의 widget-config.json 과 GitHub main 의 widget-config.json 이 두 곳에 존재하게 되는데, **GitHub main 쪽이 운영 기준**. Synology 의 것은 빌드 시 인스톨러에 박히는 DEFAULT_CONFIG fallback 의 원본이지만, 런타임 동작은 raw URL 의 것만 따름.
