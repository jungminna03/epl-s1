#!/usr/bin/env node
/**
 * EPL 위젯 릴리즈 — 한 번에 빌드 → public/updates/ 복사 → Vercel 배포.
 *
 * 사용법:
 *   1) package.json의 version을 올린다 (e.g. 0.1.0 → 0.1.1)
 *   2) npm run release
 *
 * 동작:
 *   - electron:release 실행 → release/EPL-공지사항-Setup-x.y.z.exe + latest.yml 생성
 *   - release/ 산출물을 public/updates/ 로 복사 (해당 폴더는 .gitignore)
 *   - 자동으로 vercel --prod 호출 (Vercel CLI 로그인 상태여야 함)
 *
 * 결과: https://epl-s1.vercel.app/updates/latest.yml 에 새 매니페스트가 게시되고,
 *       기존에 설치된 위젯들이 30분 이내에 업데이트를 감지·다운로드한다.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE_DIR = join(ROOT, "release");
const UPDATES_DIR = join(ROOT, "public", "updates");

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

console.log("=== EPL 위젯 릴리즈 ===");

run("npm", ["run", "electron:release"]);

if (!existsSync(RELEASE_DIR)) {
  console.error(`release/ 가 없습니다 — 빌드 산출물을 찾을 수 없음.`);
  process.exit(1);
}

mkdirSync(UPDATES_DIR, { recursive: true });

// electron-updater가 인식하는 자산: latest.yml, *.exe, *.exe.blockmap
const KEEP = /\.(exe|exe\.blockmap|yml)$/i;
const copied = [];
for (const f of readdirSync(RELEASE_DIR)) {
  if (!KEEP.test(f)) continue;
  copyFileSync(join(RELEASE_DIR, f), join(UPDATES_DIR, f));
  copied.push(f);
}

if (copied.length === 0) {
  console.error("public/updates/ 로 복사할 파일이 없습니다.");
  process.exit(1);
}

console.log("\n복사된 파일:");
copied.forEach((f) => console.log("  •", f));

console.log("\n▶ Vercel 배포");
run("npx", ["vercel", "--prod", "--yes"]);

console.log("\n✓ 완료. 배포 URL의 /updates/latest.yml 을 확인하세요.");
