import { NextResponse } from "next/server";
import type {
  DiscordMessageMap,
  DiscordNoticePayload,
  DiscordSyncRequest,
} from "@/lib/discord";
import {
  deleteNoticeMessages,
  discordToken,
  upsertNoticeMessages,
} from "@/lib/discord-server";

/**
 * POST /api/discord/announce
 *
 * 공지 1건을 디스코드 채널(들)과 동기화한다. admin 클라이언트가 저장/삭제 직후 호출.
 * 학년 → 채널 라우팅과 멘션은 서버 env 로만 결정 (src/lib/discord-server.ts).
 *
 * Body: DiscordSyncRequest { action: "upsert" | "delete", notice, existing }
 * Response:
 *   200 { ok: boolean, messages: { [channelId]: messageId } }
 *       — ok=false 는 일부 채널 실패. messages 는 그 시점의 최신 매핑(성공한 것만 반영).
 *   400 { error: "invalid_payload" }
 *   503 { error: "discord_disabled" } — DISCORD_BOT_TOKEN 미설정 (앱은 정상 동작, 발송만 없음)
 *
 * 채널 env (전부 서버 전용, NEXT_PUBLIC_ 금지):
 *   DISCORD_CHANNEL_Y1 ~ Y4  학년별 채널 ID. 미설정 학년은 조용히 skip.
 *   DISCORD_CHANNEL_ALL      선택. 설정 시 모든 공지가 여기에도 올라간다.
 *   DISCORD_MENTION_Y1 ~ Y4 / DISCORD_MENTION_ALL
 *                            선택. 역할 ID | everyone | here. 해당 채널 게시 시 content 맨 앞에 멘션.
 */

function isPayload(v: unknown): v is DiscordNoticePayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.content === "string" &&
    typeof o.category === "string" &&
    typeof o.createdAt === "number"
  );
}

function isMessageMap(v: unknown): v is DiscordMessageMap {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");
}

function isSyncRequest(v: unknown): v is DiscordSyncRequest {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.action === "upsert" || o.action === "delete") &&
    isPayload(o.notice) &&
    isMessageMap(o.existing)
  );
}

export async function POST(req: Request) {
  const token = discordToken();
  if (!token) {
    return NextResponse.json({ error: "discord_disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (!isSyncRequest(body)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { action, notice, existing } = body;
  const result =
    action === "delete"
      ? await deleteNoticeMessages(token, existing)
      : await upsertNoticeMessages(token, notice, existing);

  return NextResponse.json(result, { status: 200 });
}
