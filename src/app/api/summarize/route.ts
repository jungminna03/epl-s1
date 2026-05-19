import { NextResponse } from "next/server";
import {
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  OLLAMA_TIMEOUT_MS,
  SUMMARY_SYSTEM_PROMPT,
} from "@/lib/ai-summary";

/**
 * POST /api/summarize
 *
 * Body: { title: string, content: string }
 * Response:
 *   200 { summary: string | null }   — 정상. summary=null 은 본문이 너무 짧아 호출 안 함.
 *   400 { error: "invalid_payload" } — title/content 누락
 *   503 { error: "ai_disabled" }     — OLLAMA_API_KEY 미설정
 *   502 { error: "upstream" }        — Ollama 5xx / 응답 파싱 실패
 *   504 { error: "timeout" }         — 10초 타임아웃
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
    typeof (body as { title?: unknown }).title !== "string" ||
    typeof (body as { content?: unknown }).content !== "string"
  ) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const title = (body as { title: string }).title.trim();
  const rawContent = (body as { content: string }).content;

  if (rawContent.trim().length < MIN_CONTENT_LENGTH) {
    return NextResponse.json({ summary: null }, { status: 200 });
  }

  const content =
    rawContent.length > MAX_CONTENT_LENGTH
      ? rawContent.slice(0, MAX_CONTENT_LENGTH)
      : rawContent;

  const model = process.env.OLLAMA_MODEL || "qwen3.5:9b";
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
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          { role: "user", content: `제목: ${title}\n본문: ${content}` },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    const data = (await upstream.json()) as {
      message?: { content?: unknown };
    };
    const text = data?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }

    return NextResponse.json({ summary: text.trim() }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
