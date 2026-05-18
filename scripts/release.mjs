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
