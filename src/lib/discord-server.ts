/**
 * 디스코드 동기화 — 서버 전용 로직. API Route(announce) 에서만 import 한다.
 * 토큰·채널·멘션 env 는 전부 여기서 읽는다. 클라이언트 번들에 절대 들어가면 안 된다.
 */
import {
  buildNoticeEmbed,
  splitGrades,
  type DiscordGrade,
  type DiscordMessageMap,
  type DiscordNoticePayload,
  type DiscordSyncResponse,
} from "@/lib/discord";

const DISCORD_API = "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 10_000;

const GRADE_ENV: Record<DiscordGrade, string> = {
  "1학년": "DISCORD_CHANNEL_Y1",
  "2학년": "DISCORD_CHANNEL_Y2",
  "3학년": "DISCORD_CHANNEL_Y3",
  "4학년": "DISCORD_CHANNEL_Y4",
  전체: "DISCORD_CHANNEL_ALL",
};

/** 토큰이 없으면 연동 꺼짐. 라우트는 503 으로 응답한다. */
export function discordToken(): string | null {
  const t = process.env.DISCORD_BOT_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

/** 채널 env 이름 → 멘션 env 이름. DISCORD_CHANNEL_Y1 ↔ DISCORD_MENTION_Y1 */
function mentionEnvFor(channelEnv: string): string {
  return channelEnv.replace("DISCORD_CHANNEL_", "DISCORD_MENTION_");
}

interface Mention {
  text: string;
  roles: string[];
  everyone: boolean;
}

/**
 * 멘션 env 값 → content 조각 + allowed_mentions.
 *   "everyone" | "here" → @everyone / @here
 *   숫자 문자열       → 역할 ID (<@&id>)
 */
function parseMention(raw: string | undefined): Mention | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v === "everyone") return { text: "@everyone", roles: [], everyone: true };
  if (v === "here") return { text: "@here", roles: [], everyone: true };
  if (/^\d+$/.test(v)) return { text: `<@&${v}>`, roles: [v], everyone: false };
  console.warn(`[discord] ignoring malformed mention value: "${v}"`);
  return null;
}

interface Target {
  channelId: string;
  mentions: Mention[];
}

/**
 * 카테고리 → 발송 대상 채널 (dedupe, 미설정 skip). 같은 채널에 여러 대상이 걸리면 멘션을 합친다.
 *
 * "전체" 도 GRADE_ENV 를 통해 다른 학년과 똑같이 처리된다 — 고른 대상의 채널에만 간다.
 * (예전엔 여기서 DISCORD_CHANNEL_ALL 을 무조건 덧붙여 모든 공지가 전체 채널에 미러됐다.
 *  2026-09-09 에 "전체는 대등한 5번째 대상" 으로 정리하며 제거.)
 */
function resolveTargets(category: string): Target[] {
  const byChannel = new Map<string, Target>();
  const add = (channelEnv: string) => {
    const id = process.env[channelEnv]?.trim();
    if (!id) return;
    const t = byChannel.get(id) ?? { channelId: id, mentions: [] };
    const m = parseMention(process.env[mentionEnvFor(channelEnv)]);
    if (m && !t.mentions.some((x) => x.text === m.text)) t.mentions.push(m);
    byChannel.set(id, t);
  };
  for (const g of splitGrades(category)) add(GRADE_ENV[g]);
  return [...byChannel.values()];
}

/** 채널별 메시지 페이로드. 멘션이 있으면 content 에 붙이고 allowed_mentions 로 명시 허용. */
function buildMessage(embed: unknown, mentions: Mention[]) {
  if (mentions.length === 0) {
    return { embeds: [embed], allowed_mentions: { parse: [] } };
  }
  const roles = [...new Set(mentions.flatMap((m) => m.roles))];
  const everyone = mentions.some((m) => m.everyone);
  return {
    content: mentions.map((m) => m.text).join(" "),
    embeds: [embed],
    allowed_mentions: { parse: everyone ? ["everyone"] : [], roles },
  };
}

interface DiscordResult {
  ok: boolean;
  status: number;
  json: unknown;
}

/** Discord REST 호출. 429 는 retry_after 만큼 기다렸다가 1회 재시도. 실패는 throw 대신 status 로. */
async function discordFetch(
  token: string,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  retried = false,
): Promise<DiscordResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${DISCORD_API}${path}`, {
      method,
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 429 && !retried) {
      const j = (await res.json().catch(() => null)) as { retry_after?: number } | null;
      const waitMs = Math.min(Math.max((j?.retry_after ?? 1) * 1000, 250), 5000);
      await new Promise((r) => setTimeout(r, waitMs));
      return discordFetch(token, method, path, body, true);
    }

    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`[discord] ${method} ${path} → ${res.status}`, JSON.stringify(json)?.slice(0, 300));
    }
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    console.error(`[discord] ${method} ${path} failed:`, err instanceof Error ? err.message : err);
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

function messageIdOf(json: unknown): string | null {
  const id = (json as { id?: unknown } | null)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** 기존 메시지 전부 삭제. 404(이미 없음)는 성공으로 본다. */
export async function deleteNoticeMessages(
  token: string,
  existing: DiscordMessageMap,
): Promise<DiscordSyncResponse> {
  const messages: DiscordMessageMap = { ...existing };
  let ok = true;
  for (const [channelId, messageId] of Object.entries(existing)) {
    const r = await discordFetch(token, "DELETE", `/channels/${channelId}/messages/${messageId}`);
    if (r.ok || r.status === 404) delete messages[channelId];
    else ok = false;
  }
  return { ok, messages };
}

/**
 * 공지 1건 upsert: 대상 채널에 없으면 POST, 있으면 PATCH, 대상에서 빠진 채널은 DELETE.
 * 성공한 것만 매핑에 반영한다 — 실패한 채널은 기존 값을 유지해 다음 저장 때 재시도되게.
 */
export async function upsertNoticeMessages(
  token: string,
  notice: DiscordNoticePayload,
  existing: DiscordMessageMap,
): Promise<DiscordSyncResponse> {
  const messages: DiscordMessageMap = { ...existing };
  let ok = true;

  const targets = resolveTargets(notice.category);
  const targetIds = new Set(targets.map((t) => t.channelId));
  const embed = buildNoticeEmbed(notice);

  // 1) 더 이상 대상이 아닌 채널(학년 변경 등)의 메시지는 삭제.
  for (const [channelId, messageId] of Object.entries(existing)) {
    if (targetIds.has(channelId)) continue;
    const r = await discordFetch(token, "DELETE", `/channels/${channelId}/messages/${messageId}`);
    if (r.ok || r.status === 404) delete messages[channelId];
    else ok = false;
  }

  // 2) 대상 채널: 이미 있으면 PATCH, 없으면(또는 원본이 사라졌으면) POST.
  for (const { channelId, mentions } of targets) {
    // 수정(PATCH) 시에도 content 를 그대로 보내야 멘션 문구가 지워지지 않는다.
    // Discord 는 편집으로는 알림을 다시 울리지 않으므로 중복 알림 걱정은 없다.
    const payload = buildMessage(embed, mentions);
    const existingId = existing[channelId];
    if (existingId) {
      const r = await discordFetch(token, "PATCH", `/channels/${channelId}/messages/${existingId}`, payload);
      if (r.ok) continue;
      if (r.status !== 404) {
        ok = false;
        continue;
      }
      // 메시지가 채널에서 수동 삭제된 경우 → 새로 올린다.
      delete messages[channelId];
    }
    const r = await discordFetch(token, "POST", `/channels/${channelId}/messages`, payload);
    const newId = r.ok ? messageIdOf(r.json) : null;
    if (newId) messages[channelId] = newId;
    else ok = false;
  }

  return { ok, messages };
}
