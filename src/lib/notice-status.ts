import { getEffectivePeriod } from "@/lib/categories";
import type { Notice } from "@/lib/instant";

/** 공지의 게시 상태. */
export type NoticeStatus = "active" | "upcoming" | "expired";

/** 관리자 목록 탭. */
export type NoticeTab = "all" | NoticeStatus;

export const NOTICE_TABS: readonly NoticeTab[] = [
  "all",
  "active",
  "upcoming",
  "expired",
] as const;

const TAB_SET = new Set<NoticeTab>(NOTICE_TABS);

/** 임의 문자열이 유효한 탭 키인지 확인. */
export function isNoticeTab(value: string): value is NoticeTab {
  return TAB_SET.has(value as NoticeTab);
}

/**
 * 현재 시각 기준 공지 상태 판정.
 * 기간 계산은 categories.ts 의 getEffectivePeriod 를 사용 — 단일 정의.
 */
export function getNoticeStatus(notice: Notice, now: number): NoticeStatus {
  const { start, end } = getEffectivePeriod(notice);
  if (now < start) return "upcoming";
  if (now > end) return "expired";
  return "active";
}

/** 탭 기준으로 공지 배열 필터. "all" 은 입력 그대로 돌려준다. */
export function filterByTab(
  notices: Notice[],
  tab: NoticeTab,
  now: number,
): Notice[] {
  if (tab === "all") return notices;
  return notices.filter((n) => getNoticeStatus(n, now) === tab);
}

/** 상태별 카운트. all 키는 합계. */
export function countByStatus(
  notices: Notice[],
  now: number,
): Record<NoticeTab, number> {
  const counts: Record<NoticeTab, number> = {
    all: notices.length,
    active: 0,
    upcoming: 0,
    expired: 0,
  };
  for (const n of notices) {
    counts[getNoticeStatus(n, now)] += 1;
  }
  return counts;
}
