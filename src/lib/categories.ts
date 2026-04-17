import type { Category } from "./instant";

/**
 * 카테고리별 배지/카드 스타일.
 * - dot: 카드 좌측 컬러 점/스트라이프용
 * - badge: 배지 컨테이너 (배경/테두리/텍스트)
 * - ring: 카드 외곽선 강조 (긴급 등)
 * - label: 사람이 읽는 라벨 (한국어)
 */
export interface CategoryStyle {
  label: string;
  dot: string;
  badge: string;
  ring: string;
}

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  긴급: {
    label: "긴급",
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-300 border-red-500/40",
    ring: "ring-1 ring-red-500/40",
  },
  휴강: {
    label: "휴강",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    ring: "ring-1 ring-amber-500/30",
  },
  일반: {
    label: "일반",
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/40",
    ring: "ring-1 ring-white/5",
  },
};

/**
 * 작성/수정 시각을 한국어 상대 표현으로 변환.
 */
export function formatRelative(ts: number, now: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return "방금 전";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * 절대 시각 — 디스플레이 카드 하단에 작게 표시.
 */
export function formatAbsolute(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
