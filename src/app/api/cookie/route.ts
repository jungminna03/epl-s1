import { NextResponse } from "next/server";
import type { CookieResult } from "@/lib/cookie";

const OLLAMA_CLOUD_API_KEY = process.env.OLLAMA_CLOUD_API_KEY;
const OLLAMA_CLOUD_BASE_URL = process.env.OLLAMA_CLOUD_BASE_URL ?? "https://ollama.com";
const OLLAMA_CLOUD_MODEL = process.env.OLLAMA_CLOUD_MODEL ?? "gemma3:4b";

function buildPrompt(concept: string, starCount: number): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const stars = "★".repeat(starCount) + "☆".repeat(5 - starCount);

  return `당신은 한국 전통 스타일 포춘쿠키 운세를 만드는 전문가입니다. 주어진 주제에 맞는 짧고 임팩트 있는 포춘쿠키 운세 문구를 작성해 주세요.

[오늘 날짜] ${todayStr}
[주제] ${concept}
[총운 별점] ${stars} (${starCount}개)

[톤]
${starCount >= 4 ? "긍정적이고 희망찬 톤. 용기와 에너지를 드리는 조언입니다." :
  starCount === 3 ? "균형 잡힌 톤. 좋은 점과 조심할 점을 함께 말씀드립니다." :
  starCount === 2 ? "경고성 톤. 어려움을 솔직히 말씀드리고 극복 방법도 함께 제시해 드립니다." :
  "현실적이고 직설적인 톤. 나쁜 점을 솔직히 말씀드리고 주의사항을 강조해 드립니다."}

[말투]
- 반드시 경어체(~습니다 / ~해요 / ~드립니다)로 통일. 평어말(~이다 / ~할 것이다 / ~하라) 절대 사용 금지.
- '~할 것입니다' / '~입니다' / '~하세요' 형태의 단정적이고 조언적인 문장.
- 예시: '오늘은 새로운 시작에 용기를 내시는 날입니다.' / '작은 성실이 큰 행운을 부릅니다.'

[출력 요구사항]
1. 첫 줄: ${stars}
2. 둘째 줄부터: 메시지 본문 (60~120자, 짧고 기억에 남는 문구)
3. 마지막 3줄: 행운 키워드 3개

[출력 형식]
${stars}

오늘은 ... (은/는) ... 할 것입니다.

행운의 키워드: ...
행운의 키워드: ...
행운의 키워드: ...`;
}

function parseCookie(text: string, forcedStars: string): CookieResult {
  const keywordMatches: string[] = [];
  const kwRegex = /행운의 키워드[:：]?\s*(.+)/g;
  let m;
  while ((m = kwRegex.exec(text)) !== null) {
    keywordMatches.push(m[1].trim());
  }

  // 별점 제거, 키워드 라인 제거 → 본문
  const cleanText = text
    .replace(/[★☆]+/g, "")
    .replace(/행운의 키워드[:：]?.+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = cleanText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const message = lines[0]?.replace(/^"|"$/g, "").trim() ?? "오늘의 운세는 당신 손에 달려 있습니다.";

  return {
    message,
    keywords: keywordMatches.slice(0, 3),
    stars: forcedStars,
  };
}

export async function POST(request: Request) {
  try {
    const { concept }: { concept?: string } = (await request.json()) as { concept?: string };

    if (!concept) {
      return NextResponse.json({ success: false, error: "주제가 필요합니다." }, { status: 400 });
    }

    if (!OLLAMA_CLOUD_API_KEY) {
      return NextResponse.json({ success: false, error: "API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    const starCount = Math.floor(Math.random() * 5) + 1;
    const forcedStars = "★".repeat(starCount) + "☆".repeat(5 - starCount);
    const prompt = buildPrompt(concept, starCount);
    const url = `${OLLAMA_CLOUD_BASE_URL}/api/generate`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OLLAMA_CLOUD_API_KEY}`,
      },
      body: JSON.stringify({
        model: OLLAMA_CLOUD_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.85, num_predict: 400 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Ollama Cloud Cookie]", res.status, errText);
      return NextResponse.json({ success: false, error: `Ollama Cloud 오류 (${res.status})` }, { status: 502 });
    }

    const json = (await res.json()) as { response?: string };
    const text = json.response ?? "";
    if (!text) return NextResponse.json({ success: false, error: "응답이 비어 있습니다." }, { status: 502 });

    const result = parseCookie(text, forcedStars);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("[/api/cookie]", err);
    return NextResponse.json({ success: false, error: err.message || "서버 오류" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
