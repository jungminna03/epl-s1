/**
 * 디스코드 공지 연동 — 공용 타입 / embed 빌더 / 클라이언트 헬퍼.
 *
 * - 서버(API Route) 는 buildNoticeEmbed + 타입만 쓴다. 토큰·채널 env 는 route 에서만 읽는다.
 * - 클라이언트(admin) 는 syncDiscord 만 쓴다. 이 파일엔 시크릿이 절대 들어오지 않는다.
 *
 * 의도적으로 `@/lib/instant` / `@/lib/categories` 를 import 하지 않는다 — 둘은 "use client"
 * 모듈(InstantDB init)이라 서버 라우트에서 끌어오면 안 된다. 필요한 학년 상수는 여기서 자체 정의.
 */

/**
 * 발송 대상 라벨. `src/lib/instant.ts` 의 CATEGORIES 와 동일해야 한다.
 * "전체" 는 학년의 합집합이 아니라 자기 채널을 가진 대등한 대상이다.
 */
export const DISCORD_GRADES = ["1학년", "2학년", "3학년", "4학년", "전체"] as const;
export type DiscordGrade = (typeof DISCORD_GRADES)[number];

/** 대상별 embed 색상 — `categories.ts` 의 CATEGORY_STYLES.color 와 동일한 hex. */
const GRADE_COLOR: Record<DiscordGrade, number> = {
  "1학년": 0x22d3ee,
  "2학년": 0xa78bfa,
  "3학년": 0x34d399,
  "4학년": 0xfb923c,
  전체: 0x94a3b8,
};

/** 채널 ID → 그 채널에 올라간 메시지 ID. 공지에 저장되어 수정/삭제 동기화에 쓴다. */
export type DiscordMessageMap = Record<string, string>;

/** 디스코드로 보낼 공지 스냅샷. 저장이 끝난 최종값(AI 제목·요약 포함)을 넘긴다. */
export interface DiscordNoticePayload {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  /** 쉼표 구분 학년 문자열 (e.g. "1학년,3학년") */
  category: string;
  link?: string | null;
  professor?: string | null;
  createdAt: number;
  startDate?: number | null;
  endDate?: number | null;
}

export interface DiscordSyncRequest {
  /** upsert: 대상 채널에 없으면 생성, 있으면 수정. delete: 기존 메시지 전부 삭제. */
  action: "upsert" | "delete";
  notice: DiscordNoticePayload;
  /** 이 공지가 이미 디스코드에 올라가 있다면 그 매핑. 없으면 {} */
  existing: DiscordMessageMap;
}

export interface DiscordSyncResponse {
  ok: boolean;
  /** 동기화 후 최신 매핑. 공지에 그대로 저장하면 된다. */
  messages: DiscordMessageMap;
}

/** Discord embed 최대치 보호 (description 4096, field value 1024). */
const DESCRIPTION_CAP = 2000;
const TITLE_CAP = 256;

/** "1학년,3학년" → ["1학년","3학년"] (알 수 없는 값은 버림) */
export function splitGrades(raw: string): DiscordGrade[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is DiscordGrade =>
      (DISCORD_GRADES as readonly string[]).includes(s),
    );
}

const AUTO_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** 서버는 UTC 로 돌 수 있으므로 반드시 서울 기준으로 포맷. */
function fmtDateKST(ts: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(ts))
    .replace(/\.\s*$/, "")
    .replace(/\.\s+/g, ".");
}

function cap(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Discord REST 의 embed 객체 (필요한 필드만). */
export interface DiscordEmbed {
  title: string;
  description: string;
  url?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer: { text: string };
  timestamp: string;
}

/**
 * 공지 → embed. 순수 함수. 서버/클라 어디서든 호출 가능.
 *
 * - 요약이 있으면 굵게 첫 줄, 그 아래 본문 전체(2000자 cap). 채널만 보는 사람도 내용을 다 볼 수 있게.
 * - 게시 기간은 항상 표시. 종료일 미지정이면 "시작 + 7일 (자동 종료)" 로 계산해 그대로 안내.
 * - 색상은 첫 번째 학년 기준. 여러 학년이면 footer 에 전부 표기.
 */
export function buildNoticeEmbed(n: DiscordNoticePayload): DiscordEmbed {
  const grades = splitGrades(n.category);
  const color = grades.length > 0 ? GRADE_COLOR[grades[0]] : 0x64748b;

  const start = n.startDate ?? n.createdAt;
  const isAutoEnd = n.endDate == null;
  const end = n.endDate ?? start + AUTO_PERIOD_MS;
  const period = `${fmtDateKST(start)} ~ ${fmtDateKST(end)}${isAutoEnd ? " (자동 종료)" : ""}`;

  // 날짜를 본문 맨 위에 — 채널에서 스크롤하며 봐도 기간이 바로 눈에 들어오게.
  const summary = n.summary?.trim();
  const body = n.content.trim();
  const lines = [`📅 ${period}`];
  if (summary && summary.length > 0) lines.push(`**${summary}**`);
  lines.push(body);
  const description = cap(lines.join("\n\n"), DESCRIPTION_CAP);

  const fields: DiscordEmbed["fields"] = [];
  if (n.professor && n.professor.trim()) {
    fields.push({ name: "담당", value: n.professor.trim(), inline: true });
  }
  const link = n.link?.trim();
  if (link) {
    fields.push({ name: "바로가기", value: link, inline: false });
  }

  const gradeLabel = grades.length > 0 ? grades.join(" · ") : "학년 미지정";

  return {
    title: cap(n.title || "제목 없음", TITLE_CAP),
    description,
    ...(link ? { url: link } : {}),
    color,
    fields,
    footer: { text: `EPL 공지 · ${gradeLabel}` },
    timestamp: new Date(n.createdAt).toISOString(),
  };
}

/**
 * /api/discord/announce 호출. admin 클라이언트가 사용.
 *
 * 실패해도 throw 하지 않고 null 반환 — 공지 저장/삭제 흐름은 절대 막지 않는다.
 * (`requestMeta` 와 같은 정책.) 503(discord_disabled) 도 null → 호출자는 매핑을 건드리지 않는다.
 */
export async function syncDiscord(
  req: DiscordSyncRequest,
): Promise<DiscordSyncResponse | null> {
  try {
    const res = await fetch("/api/discord/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<DiscordSyncResponse>;
    if (typeof json.ok !== "boolean" || !json.messages || typeof json.messages !== "object") {
      return null;
    }
    return { ok: json.ok, messages: json.messages as DiscordMessageMap };
  } catch {
    return null;
  }
}

/** 매핑이 비어 있지 않은지 (= 디스코드에 실제로 올라간 공지인지) */
export function hasDiscordMessages(map: DiscordMessageMap | null | undefined): map is DiscordMessageMap {
  return !!map && Object.keys(map).length > 0;
}
