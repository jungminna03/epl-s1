import type { Category } from "./instant";

export interface CategoryStyle {
  label: string;
  /** Accent color hex value */
  color: string;
  /** Tailwind classes for the left color bar */
  dot: string;
  /** Tailwind classes for badge container */
  badge: string;
  /** Tailwind classes for card ring/outline */
  ring: string;
  /** CSS color for progress bar */
  progressColor: string;
  /** CSS background for active card in list */
  activeBg: string;
  /** CSS border color for active card */
  activeBorder: string;
  /** CSS background for detail panel glow */
  glowGradient: string;
}

/** 태그 미선택 시 사용할 기본 스타일 */
export const DEFAULT_STYLE: CategoryStyle = {
  label: "",
  color: "#64748b",
  dot: "bg-slate-500",
  badge: "",
  ring: "",
  progressColor: "rgba(100,116,139,0.4)",
  activeBg: "#1e2a3d",
  activeBorder: "rgba(100,116,139,0.15)",
  glowGradient:
    "radial-gradient(ellipse at 40% 50%, rgba(100,116,139,0.04) 0%, transparent 55%)",
};

export const CATEGORY_STYLES: Record<Category, CategoryStyle> = {
  "1학년": {
    label: "1학년",
    color: "#22d3ee",
    dot: "bg-cyan-400",
    badge: "bg-cyan-400/10 text-cyan-400 border-cyan-400/15",
    ring: "",
    progressColor: "rgba(34,211,238,0.4)",
    activeBg: "#1e2a3d",
    activeBorder: "rgba(34,211,238,0.15)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(34,211,238,0.04) 0%, transparent 55%)",
  },
  "2학년": {
    label: "2학년",
    color: "#a78bfa",
    dot: "bg-violet-400",
    badge: "bg-violet-400/10 text-violet-400 border-violet-400/15",
    ring: "",
    progressColor: "rgba(167,139,250,0.4)",
    activeBg: "#1e2030",
    activeBorder: "rgba(167,139,250,0.15)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(167,139,250,0.04) 0%, transparent 55%)",
  },
  "3학년": {
    label: "3학년",
    color: "#34d399",
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/15",
    ring: "",
    progressColor: "rgba(52,211,153,0.4)",
    activeBg: "#1e2520",
    activeBorder: "rgba(52,211,153,0.12)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(52,211,153,0.04) 0%, transparent 55%)",
  },
  "4학년": {
    label: "4학년",
    color: "#fb923c",
    dot: "bg-orange-400",
    badge: "bg-orange-400/10 text-orange-400 border-orange-400/15",
    ring: "",
    progressColor: "rgba(251,146,60,0.4)",
    activeBg: "#25201e",
    activeBorder: "rgba(251,146,60,0.15)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(251,146,60,0.04) 0%, transparent 55%)",
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

/**
 * 공지가 현재 게시 기간 내인지 판별.
 * - startDate 없으면 createdAt 사용
 * - endDate 없으면 무기한
 */
export function isNoticeVisible(
  notice: { createdAt: number; startDate?: number; endDate?: number },
  now: number = Date.now(),
): boolean {
  const start = notice.startDate ?? notice.createdAt;
  if (now < start) return false;
  if (notice.endDate == null) return true;
  return now <= notice.endDate;
}
