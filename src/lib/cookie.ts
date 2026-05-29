/**
 * 포춘쿠키 — 타입/유틸리티
 */

export type CookieConcept = "학업" | "취업" | "연애" | "금전" | "건강" | "전체";

export interface CookieResult {
  /** 운세 본문 (짧고 임팩트 있는 문구) */
  message: string;
  /** 행운 키워드 (3개) */
  keywords: string[];
  /** 별점 (메시지 톤에 따라 자유롭게) */
  stars: string;
}

export interface CookieApiResponse {
  success: boolean;
  result?: CookieResult;
  error?: string;
}

export async function fetchCookie(
  concept: CookieConcept,
  signal?: AbortSignal,
): Promise<CookieResult> {
  const res = await fetch("/api/cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept }),
    signal,
  });
  const json = (await res.json()) as CookieApiResponse;
  if (!res.ok || !json.success) throw new Error(json.error || `API 오류: ${res.status}`);
  if (!json.result) throw new Error("포춘쿠키 결과가 비어 있습니다.");
  return json.result;
}

export const CONCEPTS: { value: CookieConcept; label: string; icon: string; accent: string }[] = [
  { value: "학업", label: "학업", icon: "📚", accent: "#60a5fa" },
  { value: "취업", label: "취업", icon: "💼", accent: "#22d3ee" },
  { value: "연애", label: "연애", icon: "💕", accent: "#f472b6" },
  { value: "금전", label: "금전", icon: "💰", accent: "#fbbf24" },
  { value: "건강", label: "건강", icon: "💪", accent: "#34d399" },
  { value: "전체", label: "전체", icon: "✨", accent: "#a78bfa" },
];

export type CookieView = "select" | "loading" | "result";

export type CookieVariant = "widget" | "display";
