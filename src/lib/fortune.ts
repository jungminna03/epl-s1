/**
 * 오늘의 운세 — 서버 중계 API 호출 유틸리티
 */

export type Gender = "male" | "female";

export interface FortuneFormData {
  gender: Gender | "";
  birthYear: number | "";
  birthMonth: number | "";
  birthDay: number | "";
  birthTime: string;
}

export interface FortuneResult {
  fullText: string;
  stars: string;
  summary: string;
  advice: string;
  luckyColor?: string;
  luckyDirection?: string;
  luckyNumber?: string;
}

export type FortuneView = "notice" | "input" | "loading" | "result";

export interface TimeSlot {
  value: string;
  label: string;
  range: string;
}

export const TIME_SLOTS: TimeSlot[] = [
  { value: "자시", label: "자시 (子時)", range: "23:30 ~ 01:30" },
  { value: "축시", label: "축시 (丑時)", range: "01:30 ~ 03:30" },
  { value: "인시", label: "인시 (寅時)", range: "03:30 ~ 05:30" },
  { value: "묘시", label: "묘시 (卯時)", range: "05:30 ~ 07:30" },
  { value: "진시", label: "진시 (辰時)", range: "07:30 ~ 09:30" },
  { value: "사시", label: "사시 (巳時)", range: "09:30 ~ 11:30" },
  { value: "오시", label: "오시 (午時)", range: "11:30 ~ 13:30" },
  { value: "미시", label: "미시 (未時)", range: "13:30 ~ 15:30" },
  { value: "신시", label: "신시 (申時)", range: "15:30 ~ 17:30" },
  { value: "유시", label: "유시 (酉時)", range: "17:30 ~ 19:30" },
  { value: "술시", label: "술시 (戌時)", range: "19:30 ~ 21:30" },
  { value: "해시", label: "해시 (亥時)", range: "21:30 ~ 23:30" },
];

export const TIME_UNKNOWN = "모름";

export function getYearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = 1900; y <= current; y++) years.push(y);
  return years.reverse();
}

export function getMonthOptions(): number[] {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

export function getDayOptions(): number[] {
  return Array.from({ length: 31 }, (_, i) => i + 1);
}

export interface FortuneApiResponse {
  success: boolean;
  result?: FortuneResult;
  error?: string;
}

export async function fetchFortune(
  data: FortuneFormData,
  signal?: AbortSignal,
): Promise<FortuneResult> {
  const res = await fetch("/api/fortune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal,
  });
  const json = (await res.json()) as FortuneApiResponse;
  if (!res.ok || !json.success) throw new Error(json.error || `API 오류: ${res.status}`);
  if (!json.result) throw new Error("운세 결과가 비어 있습니다.");
  return json.result;
}

export function isFortuneFormValid(data: FortuneFormData): boolean {
  return data.gender !== "" && data.birthYear !== "" && data.birthMonth !== "" && data.birthDay !== "";
}

export function genderLabel(g: Gender | ""): string {
  if (g === "male") return "남성";
  if (g === "female") return "여성";
  return "";
}
