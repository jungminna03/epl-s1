import { CATEGORIES, type Category } from "./instant";

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
  // 전 학년 대상. 학년 4색(cyan/violet/emerald/orange)과 겹치지 않는 중립 슬레이트 —
  // 방송성 공지라 디스플레이에서 특정 학년처럼 튀지 않는 편이 낫다.
  전체: {
    label: "전체",
    color: "#94a3b8",
    dot: "bg-slate-400",
    badge: "bg-slate-400/10 text-slate-300 border-slate-400/15",
    ring: "",
    progressColor: "rgba(148,163,184,0.4)",
    activeBg: "#1f232b",
    activeBorder: "rgba(148,163,184,0.15)",
    glowGradient:
      "radial-gradient(ellipse at 40% 50%, rgba(148,163,184,0.04) 0%, transparent 55%)",
  },
};

/** formatRelative 가 상대 표현("N일 전")을 유지하는 최대 일수. 이후엔 날짜로 폴백. */
const RELATIVE_MAX_DAYS = 7;

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
  if (day < RELATIVE_MAX_DAYS) return `${day}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * formatRelative(ts) 가 날짜 폴백이 아닌 상대 표현("N분 전" 등)으로 나오는지.
 * 게시 기간 라벨과 날짜가 중복 표기되는 걸 막을 때 사용.
 */
export function isRelativeFresh(ts: number, now: number = Date.now()): boolean {
  return now - ts < RELATIVE_MAX_DAYS * 24 * 60 * 60 * 1000;
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
 * 게시 기간 라벨 — 종료일(endDate)을 명시한 공지만 "YY.MM.DD ~ YY.MM.DD" 반환.
 * 자동 종료(7일 룰) 공지는 null (기간을 보여줄 의미가 없음).
 */
export function formatPeriodLabel(notice: {
  createdAt: number;
  startDate?: number;
  endDate?: number;
}): string | null {
  const { start, end, isAutoEnd } = getEffectivePeriod(notice);
  if (isAutoEnd) return null;
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getFullYear() % 100).padStart(2, "0")}.${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  return `${fmt(start)} ~ ${fmt(end)}`;
}

/**
 * 쉼표로 구분된 카테고리 문자열을 파싱.
 * "1학년,3학년" → ["1학년", "3학년"]
 */
export function parseCategories(raw: string): Category[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Category =>
      (CATEGORIES as readonly string[]).includes(s),
    );
}

/** 종료일을 지정하지 않은 공지가 자동으로 사라지기까지의 기간(일). */
export const AUTO_PERIOD_DAYS = 7;
const AUTO_PERIOD_MS = AUTO_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export interface EffectivePeriod {
  start: number;
  end: number;
  /** endDate 가 비어 있어 start + AUTO_PERIOD_DAYS 로 자동 계산된 경우 true */
  isAutoEnd: boolean;
}

/**
 * 공지의 실효 게시 기간을 계산.
 * - startDate 없으면 createdAt 폴백
 * - endDate 없으면 start + AUTO_PERIOD_DAYS (기본 7일) 자동 종료
 */
export function getEffectivePeriod(
  notice: { createdAt: number; startDate?: number; endDate?: number },
): EffectivePeriod {
  const start = notice.startDate ?? notice.createdAt;
  if (notice.endDate != null) {
    return { start, end: notice.endDate, isAutoEnd: false };
  }
  return { start, end: start + AUTO_PERIOD_MS, isAutoEnd: true };
}

/**
 * 공지가 현재 게시 기간 내인지 판별.
 * 종료일이 비어 있으면 시작일 + AUTO_PERIOD_DAYS 까지만 노출.
 */
export function isNoticeVisible(
  notice: { createdAt: number; startDate?: number; endDate?: number },
  now: number = Date.now(),
): boolean {
  const { start, end } = getEffectivePeriod(notice);
  if (now < start) return false;
  return now <= end;
}
