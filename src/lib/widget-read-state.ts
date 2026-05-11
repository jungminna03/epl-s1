/**
 * 위젯 카드의 "읽음" 상태를 클라이언트 로컬에 저장한다.
 * - PC별 독립 (InstantDB 동기화 안 함 — 익명 위젯이라 부적합)
 * - 1시간 마다 전역 일괄 리셋 → 모든 공지가 다시 "안 읽음" 상태로 부활
 *
 * 컨슈머: src/app/widget/page.tsx 의 useReadState 훅
 */

const STORAGE_KEY = "epl-widget-read-state";
const RESET_INTERVAL_MS = 60 * 60 * 1000;

export type ReadState = {
  /** 마지막 리셋 시각(ms). 이 시점 이후 클릭한 공지 id 만 readIds 에 있음. */
  resetAt: number;
  /** 현 사이클에서 읽은 공지 id 집합. */
  readIds: Set<string>;
};

type SerializedState = {
  resetAt: number;
  readIds: string[];
};

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

/** 초기 상태 — resetAt 만 now, readIds 는 비어있음. */
function freshState(now: number): ReadState {
  return { resetAt: now, readIds: new Set() };
}

/** localStorage 에서 상태를 불러온다. SSR/파싱실패/quota 모두 freshState 폴백. */
export function loadReadState(now: number = Date.now()): ReadState {
  if (!isBrowser()) return freshState(now);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState(now);
    const parsed = JSON.parse(raw) as SerializedState;
    if (
      typeof parsed.resetAt !== "number" ||
      !Array.isArray(parsed.readIds)
    ) {
      return freshState(now);
    }
    return {
      resetAt: parsed.resetAt,
      readIds: new Set(parsed.readIds.filter((x) => typeof x === "string")),
    };
  } catch {
    return freshState(now);
  }
}

/** 상태를 localStorage 에 직렬화 저장. quota/SSR 등은 조용히 무시. */
export function saveReadState(state: ReadState): void {
  if (!isBrowser()) return;
  const serialized: SerializedState = {
    resetAt: state.resetAt,
    readIds: Array.from(state.readIds),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // localStorage quota 초과 / private mode — 위젯은 그대로 동작
  }
}

/** 1시간 경과했으면 리셋된 새 상태 반환. 아니면 원본 그대로. */
export function maybeReset(state: ReadState, now: number): ReadState {
  if (now - state.resetAt > RESET_INTERVAL_MS) {
    return freshState(now);
  }
  return state;
}

/** 공지를 "읽음" 으로 표시. 이미 있으면 원본 그대로 (불필요한 리렌더 방지). */
export function markRead(state: ReadState, id: string): ReadState {
  if (state.readIds.has(id)) return state;
  const next = new Set(state.readIds);
  next.add(id);
  return { resetAt: state.resetAt, readIds: next };
}
