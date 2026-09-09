import { NextResponse } from "next/server";
import type { FortuneFormData, FortuneResult } from "@/lib/fortune";

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const FORTUNE_MODEL = process.env.OLLAMA_FORTUNE_MODEL || "gemma4:31b";

/**
 * 추론(thinking) 강도. gemma4 는 think:false 를 존중하므로 추론을 끈다.
 * 켜두면(예: "low") 추론 토큰이 num_predict 예산을 같이 깎아먹어,
 * done_reason:"length" 로 끊기며 response 가 빈 문자열로 돌아온다
 * ("응답이 비어 있습니다"). 운세/포춘쿠키 문구는 추론이 필요 없다.
 * 주의: gpt-oss 계열로 되돌릴 땐 think:false 가 무시되므로 "low" 를 써야 한다.
 */
const THINK_LEVEL = false;
/** 응답 토큰 예산. thinking 이 조금 길어져도 본문이 잘리지 않도록 여유를 둔다. */
const NUM_PREDICT = 1200;

function buildPrompt(data: FortuneFormData, starCount: number): string {
  const { gender, birthYear, birthMonth, birthDay, birthTime } = data;
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const genderText = gender === "male" ? "남성" : "여성";
  const birthText = birthYear !== "" && birthMonth !== "" && birthDay !== "" ? `${birthYear}년 ${birthMonth}월 ${birthDay}일` : "";
  const timeText = birthTime && birthTime !== "모름" ? birthTime : "";
  const stars = "★".repeat(starCount) + "☆".repeat(5 - starCount);

  const toneGuide =
    starCount >= 4
      ? "오늘은 좋은 날입니다. 긍정적인 에너지와 기회를 강조하세요."
      : starCount === 3
        ? "오늘은 무난한 날입니다. 좋은 점과 주의할 점을 균형있게 다루세요."
        : starCount === 2
          ? "오늘은 다소 힘든 날입니다. 어려움을 솔직히 말하되, 극복 방법도 함께 제시하세요."
          : "오늘은 매우 어려운 날입니다. 현실적으로 나쁜 점을 직설적으로 말하고, 주의사항을 강조하세요.";

  return `당신은 한국 전통 운세 전문가입니다. 사용자의 정보를 바탕으로 오늘의 운세를 작성해주세요.

[사용자 정보]
- 성별: ${genderText}
- 생년월일: ${birthText}
${timeText ? `- 태어난 시간: ${timeText}` : ""}
- 오늘 날짜: ${todayStr}

[총운 별점]
${stars} (${starCount}개)

[톤 가이드]
${toneGuide}

[출력 요구사항]
1. 반드시 총운 별점을 첫 줄에 표시: ${stars}
2. 별점 ${starCount}개에 맞는 현실적인 운세를 300~500자로 작성
3. 별점이 높으면 좋은 일을, 낮으면 어려움을 솔직하게 서술
4. 행운의 색상, 방위, 숫자 (각 1개)

[출력 형식]
${stars}

오늘은 ... (운세 본문)

행운의 색상: ...
행운의 방위: ...
행운의 숫자: ...`;
}

function parseFortune(text: string, forcedStars: string): FortuneResult {
  const colorMatch = text.match(/행운의 색상[:：]\s*(.+)/);
  const luckyColor = colorMatch ? colorMatch[1].trim() : undefined;
  const dirMatch = text.match(/행운의 방위[:：]\s*(.+)/);
  const luckyDirection = dirMatch ? dirMatch[1].trim() : undefined;
  const numMatch = text.match(/행운의 숫자[:：]\s*(.+)/);
  const luckyNumber = numMatch ? numMatch[1].trim() : undefined;

  // 본문에서 별점 기호 모두 제거 → stars 필드만 유일한 별점 소스
  const cleanText = text.replace(/[★☆]+/g, "").replace(/\n{3,}/g, "\n\n").trim();

  const lines = cleanText.split("\n").filter((l) => l.trim());
  const summary = lines.find((l) => l.length > 10 && !l.includes("행운의")) || "";

  const advice = cleanText
    .replace(/행운의 색상[:：].+/g, "")
    .replace(/행운의 방위[:：].+/g, "")
    .replace(/행운의 숫자[:：].+/g, "")
    .trim();

  return { fullText: cleanText, stars: forcedStars, summary, advice, luckyColor, luckyDirection, luckyNumber };
}

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as FortuneFormData;

    if (!data.gender || !data.birthYear || !data.birthMonth || !data.birthDay) {
      return NextResponse.json({ success: false, error: "필수 입력값이 누락되었습니다." }, { status: 400 });
    }

    if (!OLLAMA_API_KEY) {
      return NextResponse.json({ success: false, error: "API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    const starCount = Math.floor(Math.random() * 5) + 1;
    const forcedStars = "★".repeat(starCount) + "☆".repeat(5 - starCount);
    const prompt = buildPrompt(data, starCount);

    const res = await fetch("https://ollama.com/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: FORTUNE_MODEL,
        prompt,
        stream: false,
        think: THINK_LEVEL,
        options: { temperature: 0.8, num_predict: NUM_PREDICT },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Ollama Cloud]", res.status, errText);
      return NextResponse.json({ success: false, error: `Ollama Cloud 오류 (${res.status})` }, { status: 502 });
    }

    const json = (await res.json()) as {
      response?: string;
      thinking?: string;
      done_reason?: string;
      eval_count?: number;
    };
    const text = json.response ?? "";
    if (!text) {
      // 여기 걸리는 전형적 원인은 추론 토큰이 num_predict 를 다 먹고 끊긴 경우.
      // 원인 파악이 가능하도록 done_reason / 토큰 수를 남긴다.
      console.error(
        `[/api/fortune] empty response (model=${FORTUNE_MODEL}, ` +
          `done_reason=${json.done_reason}, eval_count=${json.eval_count}, ` +
          `thinking_len=${json.thinking?.length ?? 0})`,
      );
      return NextResponse.json({ success: false, error: "응답이 비어 있습니다." }, { status: 502 });
    }

    const result = parseFortune(text, forcedStars);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("[/api/fortune]", err);
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
