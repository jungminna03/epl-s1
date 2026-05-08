#!/usr/bin/env node
/**
 * EPL 위젯 릴리즈 — 빌드 → Vercel Blob 업로드 → Vercel 배포(웹).
 *
 * 사용법:
 *   1) package.json의 version 을 올린다
 *   2) BLOB_READ_WRITE_TOKEN 이 환경변수 또는 .env.vercel.tmp 에 있어야 함
 *      (없으면: npx vercel env pull .env.vercel.tmp --environment=production)
 *   3) npm run release
 *
 * 동작:
 *   - electron:release → release/EPL-공지사항-Setup-x.y.z.exe + latest.yml 생성
 *   - 산출물 3종(latest.yml, *.exe, *.exe.blockmap)을 Vercel Blob 에 업로드
 *     → https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/<filename>
 *   - vercel --prod 호출 → /display 페이지 등 웹 콘텐츠 배포
 *
 * 결과:
 *   - 학교 PC들은 30분 이내에 Blob의 latest.yml 폴링 → 새 버전 발견 → 백그라운드 다운로드
 *   - 다음 종료 시 자동 설치
 */

import { put } from "@vercel/blob";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE_DIR = join(ROOT, "release");
const WIDGET_CONFIG_PATH = join(ROOT, "widget-config.json");

function getBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const envPath = join(ROOT, ".env.vercel.tmp");
  if (!existsSync(envPath)) {
    console.error("BLOB_READ_WRITE_TOKEN 을 찾을 수 없습니다.");
    console.error("  → npx vercel env pull .env.vercel.tmp --environment=production 실행 후 다시 시도");
    process.exit(1);
  }
  const txt = readFileSync(envPath, "utf8");
  const m = txt.match(/^BLOB_READ_WRITE_TOKEN="?([^"\r\n]+)"?/m);
  if (!m) {
    console.error(".env.vercel.tmp 에 BLOB_READ_WRITE_TOKEN 이 없습니다.");
    process.exit(1);
  }
  return m[1];
}

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

const token = getBlobToken();

run("npm", ["run", "electron:release"]);

if (!existsSync(RELEASE_DIR)) {
  console.error(`release/ 가 없습니다 — 빌드 산출물을 찾을 수 없음.`);
  process.exit(1);
}

// electron-updater 가 인식하는 자산: latest.yml, *.exe, *.exe.blockmap
const KEEP = /\.(exe|exe\.blockmap|yml)$/i;
const targets = readdirSync(RELEASE_DIR)
  .filter((f) => KEEP.test(f) && f !== "builder-debug.yml");

if (targets.length === 0) {
  console.error("업로드할 산출물이 없습니다.");
  process.exit(1);
}

console.log(`\n▶ Vercel Blob 업로드 (${targets.length}개)`);

for (const f of targets) {
  const path = join(RELEASE_DIR, f);
  const data = readFileSync(path);
  const sizeMb = (data.length / 1024 / 1024).toFixed(1);
  console.log(`  • ${f} (${sizeMb} MB) ...`);
  // ASCII-safe 파일명: 한글이 들어가면 일부 다운로더에서 깨질 수 있어 latin1 으로 정규화
  // — basename 에서 한글이 그대로 들어가도 Blob 은 잘 처리하지만 latest.yml 의 url
  //   필드와 일치만 하면 되니 그대로 사용.
  const blob = await put(basename(f), data, {
    token,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: f.endsWith(".yml") ? "text/yaml" : "application/octet-stream",
  });
  console.log(`    → ${blob.url}`);
}

// widget-config.json 도 Blob 에 같이 올린다 — 위젯 부트스트랩이 이걸 읽음.
// 인스톨러 박힌 bootstrapUrl 을 절대 못 바꾸므로, 이 JSON 이 운영 컨트롤 패널 역할.
if (existsSync(WIDGET_CONFIG_PATH)) {
  const data = readFileSync(WIDGET_CONFIG_PATH);
  console.log(`  • widget-config.json (${data.length} B) ...`);
  const blob = await put("widget-config.json", data, {
    token,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // 짧게 캐시 — 킬스위치/긴급 변경이 빨리 전파되도록.
    cacheControlMaxAge: 60,
  });
  console.log(`    → ${blob.url}`);
} else {
  console.warn(`! widget-config.json 이 없어서 업로드 스킵 — ${WIDGET_CONFIG_PATH}`);
}

console.log("\n▶ Vercel 웹 배포 (vercel --prod)");
run("npx", ["vercel", "--prod", "--yes"]);

console.log("\n✓ 완료.");
console.log("   매니페스트: https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/latest.yml");
console.log("   부트스트랩: https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json");
console.log("   웹: https://epl-s1.vercel.app/display");
