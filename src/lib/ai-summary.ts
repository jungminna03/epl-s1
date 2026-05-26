/**
 * AI 요약 관련 상수 / 클라이언트 헬퍼.
 * - 서버 사이드(API Route) 는 SUMMARY_SYSTEM_PROMPT 만 import.
 * - 클라이언트(admin) 는 requestSummary 만 import.
 */

export const SUMMARY_SYSTEM_PROMPT = `당신은 학내 공지 요약 도우미입니다.
주어진 공지를 학생이 빠르게 파악할 수 있도록 한국어로 요약하세요.

규칙:
- 1~2문장, 총 60자 이내 (공백 포함, 절대 초과 금지)
- 가장 중요한 정보(날짜·장소·대상·제출처 중 1~2개) 우선 — 60자에 안 들어가면 덜 중요한 건 과감히 생략
- 본문에 없는 정보를 만들어내지 말 것
- "요약하면", "이 공지는" 같은 메타 표현 금지
- 평서체로 작성

출력은 요약문만. 다른 텍스트 없이.`;

/** 호출 자체를 건너뛰는 본문 길이 임계값 (이하면 호출 안 함). */
export const MIN_CONTENT_LENGTH = 30;
/** 본문이 이 길이를 넘으면 앞부분만 잘라서 보냄 (토큰 한도 보호). */
export const MAX_CONTENT_LENGTH = 8000;
/** Ollama 호출 타임아웃 (ms). */
export const OLLAMA_TIMEOUT_MS = 10_000;
/** 요약 결과 최대 길이. 모델이 프롬프트 60자 제약을 어겼을 때 안전망. 초과분은 잘리고 "…" 가 붙는다. */
export const SUMMARY_HARD_CAP = 80;

/**
 * /api/summarize 호출. admin 클라이언트가 사용.
 * 실패해도 throw 하지 않고 null 반환 — admin 저장 흐름이 막히지 않도록.
 */
export async function requestSummary(
  title: string,
  content: string,
): Promise<string | null> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { summary: string | null };
    return json.summary ?? null;
  } catch {
    return null;
  }
}
