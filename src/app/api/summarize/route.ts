import { NextResponse } from "next/server";
import {
  MAX_CONTENT_LENGTH,
  META_SYSTEM_PROMPT,
  MIN_CONTENT_LENGTH,
  OLLAMA_TIMEOUT_MS,
  SUMMARY_HARD_CAP,
  TITLE_HARD_CAP,
} from "@/lib/ai-summary";

/**
 * POST /api/summarize
 *
 * Body: { content: string }
 * Response:
 *   200 { title: string | null, summary: string | null }
 *       — title=null or summary=null 은 본문이 너무 짧거나 모델 출력이 망가졌을 때.
 *   400 { error: "invalid_payload" } — content 누락
 *   503 { error: "ai_disabled" }     — OLLAMA_API_KEY 미설정
 *   502 { error: "upstream" }        — Ollama 5xx / 응답 파싱 실패
 *   504 { error: "timeout" }         — 타임아웃
 */
export async function POST(req: Request) {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { content?: unknown }).content !== "string"
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const rawContent = (body as { content: string }).content;

  if (rawContent.trim().length < MIN_CONTENT_LENGTH) {
    return NextResponse.json({ title: null, summary: null }, { status: 200 });
  }

  const content =
    rawContent.length > MAX_CONTENT_LENGTH
      ? rawContent.slice(0, MAX_CONTENT_LENGTH)
      : rawContent;

  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const upstream = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: META_SYSTEM_PROMPT },
          { role: "user", content: `본문:\n${content}` },
        ],
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "<unreadable>");
      console.error(
        `[summarize] Ollama ${upstream.status} (model=${model}):`,
        errText.slice(0, 500),
      );
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const data = (await upstream.json()) as {
      message?: { content?: unknown };
    };
    const text = data?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      console.error(
        `[summarize] Ollama OK but no content (model=${model}):`,
        JSON.stringify(data).slice(0, 500),
      );
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const { title, summary } = parseMeta(text);
    return NextResponse.json({ title, summary }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    console.error(`[summarize] fetch error (model=${model}):`, err);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 모델 응답 텍스트에서 {title, summary} 를 추출. JSON 파싱 실패 시 best-effort 로 복구.
 * - 정상 JSON: 그대로 사용
 * - 응답에 JSON 객체가 본문 안에 박혀있는 경우: 정규식으로 추출
 * - 둘 다 실패: 전체를 summary 로 간주, title 은 null
 * 추출된 값은 길이 cap 적용.
 */
function parseMeta(text: string): { title: string | null; summary: string | null } {
  const cleaned = text.trim();

  const tryParse = (s: string): { title: string | null; summary: string | null } | null => {
    try {
      const obj = JSON.parse(s) as { title?: unknown; summary?: unknown };
      const title = typeof obj.title === "string" ? capTitle(obj.title) : null;
      const summary = typeof obj.summary === "string" ? capSummary(obj.summary) : null;
      return { title, summary };
    } catch {
      return null;
    }
  };

  // 1) 그대로 파싱
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // 2) 응답 안에 박혀있는 JSON 객체 추출 시도
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    const extracted = tryParse(match[0]);
    if (extracted) return extracted;
  }

  // 3) 최후의 수단: 전체를 summary 로 간주
  return { title: null, summary: capSummary(cleaned) };
}

function capTitle(s: string): string | null {
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > TITLE_HARD_CAP
    ? `${trimmed.slice(0, TITLE_HARD_CAP - 1)}…`
    : trimmed;
}

function capSummary(s: string): string | null {
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > SUMMARY_HARD_CAP
    ? `${trimmed.slice(0, SUMMARY_HARD_CAP - 1)}…`
    : trimmed;
}
