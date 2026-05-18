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
