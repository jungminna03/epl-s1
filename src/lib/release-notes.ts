/**
 * 관리자 페이지 릴리즈 노트 — 좌하단 동그라미 버튼이 보여주는 변경 내역.
 *
 * 새 릴리즈를 낼 때 entries 맨 앞에 새 entry 를 추가한다. version 은
 * CLAUDE.md 의 위젯 버저닝 룰(V.YYYY.M.N) 과 같은 형식을 따른다.
 * 관리자가 이 패널을 열면 LATEST_VERSION 이 'seen' 으로 기록되어
 * pulse 가 해제된다.
 */

export type ReleaseTag = "ADD" | "FIX" | "UPDATE" | "REFACTOR" | "REMOVE" | "PERF" | "CHORE";

export interface ReleaseItem {
  tag: ReleaseTag;
  text: string;
}

export interface ReleaseEntry {
  version: string;
  date: string;
  items: ReleaseItem[];
}

export const RELEASE_ENTRIES: ReleaseEntry[] = [
  {
    version: "V.2026.6.6",
    date: "2026-06-04",
    items: [
      { tag: "ADD", text: "관리자 페이지 좌하단에 업데이트 내역 보기 추가" },
    ],
  },
  {
    version: "V.2026.6.5",
    date: "2026-06-03",
    items: [
      { tag: "ADD", text: "AI 제목·본문 매칭 검증 + 최대 3회 재시도" },
      { tag: "UPDATE", text: "AI 가 본문에서 제목까지 자동 생성" },
    ],
  },
  {
    version: "V.2026.6.4",
    date: "2026-06-02",
    items: [
      { tag: "UPDATE", text: "공지 상세에서 AI 요약을 본문 스크롤 영역에 포함" },
    ],
  },
  {
    version: "V.2026.6.3",
    date: "2026-06-01",
    items: [
      { tag: "FIX", text: "쿠키 API 환경변수명 통일" },
    ],
  },
  {
    version: "V.2026.6.2",
    date: "2026-05-30",
    items: [
      { tag: "UPDATE", text: "포춘쿠키 패널 native input 포커스 정책 정리" },
    ],
  },
  {
    version: "V.2026.6.1",
    date: "2026-05-28",
    items: [
      { tag: "FIX", text: "배포 위젯에서 운세 패널 select 선택 안 되던 문제" },
      { tag: "ADD", text: "포춘쿠키 시스템" },
      { tag: "ADD", text: "오늘의 운세" },
    ],
  },
];

export const LATEST_VERSION = RELEASE_ENTRIES[0]?.version ?? "";

const STORAGE_KEY = "epl.admin.releaseNotesSeen";

export function loadSeenVersion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markSeen(version: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* ignore */
  }
}

export function hasUnseenRelease(): boolean {
  const seen = loadSeenVersion();
  return seen !== LATEST_VERSION;
}
