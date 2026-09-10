import { NextResponse } from "next/server";
import {
  MAX_CONTENT_LENGTH,
  META_SYSTEM_PROMPT,
  OLLAMA_TIMEOUT_MS,
  SUMMARY_HARD_CAP,
  TITLE_HARD_CAP,
  hasSummarizableContent,
  isKoreanOutput,
  isTitleRelevant,
} from "@/lib/ai-summary";

/** 제목이 본문과 안 맞으면 최대 이만큼 재시도. (초기 호출 1 + 재시도 N) */
const MAX_ATTEMPTS = 3;

/**
 * 추론(thinking) 강도. gpt-oss 계열은 reasoning 모델이라 기본값이면 영어로 장문의
 * 추론을 먼저 돌린다 — 느릴 뿐 아니라 그 영어가 결과로 새기도 한다.
 * 제목/요약 추출은 추론이 필요 없으므로 "low" 로 묶는다.
 * (gpt-oss 는 think:false 를 무시하므로 레벨 문자열을 써야 한다.)
 */
const THINK_LEVEL = "low";

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
 *   504 { error: "timeout" }         — 첫 시도부터 타임아웃 (재시도 중 타임아웃은
 *                                      직전까지 건진 요약을 200 으로 반환)
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

  // 링크를 걷어낸 실질 텍스트 기준으로 판정 — "링크 한 줄" 본문은 호출 자체를 건너뛴다.
  if (!hasSummarizableContent(rawContent)) {
    return NextResponse.json({ title: null, summary: null }, { status: 200 });
  }

  const content =
    rawContent.length > MAX_CONTENT_LENGTH
      ? rawContent.slice(0, MAX_CONTENT_LENGTH)
      : rawContent;

  const model = process.env.OLLAMA_MODEL || "gpt-oss:120b";

  // 제목 후보를 최대 MAX_ATTEMPTS 번 받아보고, 본문과 매칭되는 첫 후보를 채택.
  // 매칭 실패가 누적되면 다음 시도에 "직전 후보는 본문과 무관했다" 는 교정 메시지를 추가.
  let lastSummary: string | null = null;
  const rejectedTitles: string[] = [];

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: META_SYSTEM_PROMPT },
        { role: "user", content: `본문:\n${content}` },
      ];
      if (rejectedTitles.length > 0) {
        messages.push({
          role: "user",
          content:
            `이전 제목 후보 [${rejectedTitles.map((t) => `"${t}"`).join(", ")}] ` +
            `는 본문과 무관하거나 일반적 인사말입니다. ` +
            `본문의 핵심 키워드(대상/주제/시점/장소)를 반드시 포함해서 다시 만들어주세요.`,
        });
      }

      // 타임아웃은 시도마다 새로 잡는다. 루프 바깥에 하나만 두면 3번의 시도가
      // 15초를 나눠 쓰게 되어, 제목 검증이 두 번 실패하면 3번째는 거의 확실히 죽는다.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
      let upstream: Response;
      try {
        upstream = await fetch("https://ollama.com/api/chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            think: THINK_LEVEL,
            format: "json",
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) throw err;
        // 이번 시도만 타임아웃. 이미 쓸 만한 요약을 건졌으면 그걸 돌려주고,
        // 첫 시도부터 죽었으면 504 로 알린다.
        console.warn(
          `[summarize] attempt ${attempt + 1} timed out after ${OLLAMA_TIMEOUT_MS}ms (model=${model})`,
        );
        if (lastSummary) break;
        return NextResponse.json({ error: "timeout" }, { status: 504 });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "<unreadable>");
        console.error(
          `[summarize] Ollama ${upstream.status} (model=${model}, attempt=${attempt + 1}):`,
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
          `[summarize] Ollama OK but no content (model=${model}, attempt=${attempt + 1}):`,
          JSON.stringify(data).slice(0, 500),
        );
        return NextResponse.json({ error: "upstream" }, { status: 502 });
      }

      const { title, summary } = parseMeta(text);
      // 한글이 없는 요약은 모델이 영어로 샌 것 — 본문에 없는 문장이므로 버린다.
      lastSummary = summary && isKoreanOutput(summary) ? summary : null;

      if (title && isTitleRelevant(title, content)) {
        return NextResponse.json(
          { title, summary: lastSummary },
          { status: 200 },
        );
      }

      if (title) rejectedTitles.push(title);
      console.warn(
        `[summarize] title rejected (attempt=${attempt + 1}, model=${model}): "${title}"`,
      );
    }

    // 모든 시도가 매칭 실패 — title 은 null 로 돌려서 클라이언트가 fallback 쓰게 한다.
    // summary 는 살릴 가치가 있으면 유지.
    console.warn(
      `[summarize] all ${MAX_ATTEMPTS} attempts failed validation, returning null title. ` +
        `rejected=${JSON.stringify(rejectedTitles)}`,
    );
    return NextResponse.json(
      { title: null, summary: lastSummary },
      { status: 200 },
    );
  } catch (err) {
    console.error(`[summarize] fetch error (model=${model}):`, err);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
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
