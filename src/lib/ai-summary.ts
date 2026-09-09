/**
 * AI 메타(제목 + 요약) 생성 관련 상수 / 클라이언트 헬퍼.
 * - 서버 사이드(API Route) 는 META_SYSTEM_PROMPT 만 import.
 * - 클라이언트(admin) 는 requestMeta 만 import.
 */

export const META_SYSTEM_PROMPT = `당신은 학내 공지 메타데이터 생성기입니다.
주어진 본문에서 "제목" 과 "요약" 을 만들어 JSON 으로 반환하세요.

[제목 규칙]
- 한국어 명사형 헤드라인, 12~22자 (공백 포함)
- 본문 핵심 키워드 우선 (대상/주제/시점 중 가장 중요한 1~2개)
- "안내", "공지", "알림" 같은 군더더기 금지
- 본문에 없는 정보를 만들어내지 말 것

[요약 규칙]
- 1~2문장, 총 60자 이내 (공백 포함, 절대 초과 금지)
- 가장 중요한 정보(날짜·장소·대상·제출처 중 1~2개) 우선 — 60자에 안 들어가면 덜 중요한 건 생략
- "요약하면", "이 공지는" 같은 메타 표현 금지
- 평서체

[언어 규칙]
- 제목/요약 모두 반드시 한국어로 작성. 영어 문장 금지.
- 본문이 링크뿐이라 요약할 내용이 없으면 지어내지 말고 {"title":null,"summary":null} 반환.

[출력]
다른 텍스트 절대 없이, 이 형식의 JSON 한 줄만:
{"title":"...","summary":"..."}`;

/** 링크(URL) 매칭. 본문에서 링크를 걷어낸 "실질 텍스트" 를 재기 위한 패턴. */
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/gi;

/** 호출 자체를 건너뛰는 본문 길이 임계값 (이하면 호출 안 함). */
export const MIN_CONTENT_LENGTH = 30;
/** 본문이 이 길이를 넘으면 앞부분만 잘라서 보냄 (토큰 한도 보호). */
export const MAX_CONTENT_LENGTH = 8000;
/** Ollama 호출 타임아웃 (ms). */
export const OLLAMA_TIMEOUT_MS = 15_000;
/** 요약 결과 최대 길이. 모델이 프롬프트 60자 제약을 어겼을 때 안전망. */
export const SUMMARY_HARD_CAP = 80;
/** 제목 결과 최대 길이. 모델이 너무 길게 뽑은 경우 안전망. */
export const TITLE_HARD_CAP = 30;

/**
 * 본문에서 링크를 걷어낸 실질 텍스트. 링크만 덜렁 있는 본문을 걸러내는 데 쓴다.
 */
export function contentWithoutUrls(content: string): string {
  return content.replace(URL_PATTERN, " ").replace(/\s+/gu, " ").trim();
}

/**
 * AI 를 부를 가치가 있는 본문인지 판정.
 *
 * URL 은 그 자체로 30자를 쉽게 넘기 때문에 단순 length 검사만 하면
 * "링크 한 줄" 본문이 게이트를 통과해버리고, 모델은 요약할 한국어가 없으니
 * 도메인/슬러그를 읽어 영어 문장을 지어낸다. 링크를 뺀 길이로 판정한다.
 */
export function hasSummarizableContent(content: string): boolean {
  return contentWithoutUrls(content).length >= MIN_CONTENT_LENGTH;
}

/** 한글이 한 글자도 없으면 모델이 영어로 샌 것 — 버린다. */
export function isKoreanOutput(s: string): boolean {
  return /[가-힣]/u.test(s);
}

export interface AiMeta {
  /** AI 가 뽑은 제목. 실패 시 null → 호출자가 본문에서 fallback 생성. */
  title: string | null;
  /** AI 가 뽑은 요약. 본문이 너무 짧거나 실패 시 null. */
  summary: string | null;
}

/**
 * 모델이 본문과 무관한 인사말/일반어로 제목을 뽑는 사고를 거르기 위한 denylist.
 */
const TITLE_DENY_PATTERNS: RegExp[] = [
  /^안녕하세요/,
  /^안녕$/,
  /^반갑습니다/,
  /^제목\s*없음$/,
  /^무제$/,
  /^공지$/,
  /^공지사항$/,
  /^안내$/,
  /^알림$/,
  /^새\s*공지/,
];

/**
 * 한글/영문/숫자만 살린 뒤 길이 2 이상 토큰만 추출. 본문/제목 비교용.
 */
function tokenize(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/u)
    .filter((t) => t.length >= 2);
  return new Set(tokens);
}

/**
 * 생성된 제목이 본문과 매칭되는지 휴리스틱으로 검증.
 *
 * 통과 조건:
 * 1) denylist (인사말/일반어) 에 안 걸리고
 * 2) 제목 토큰 중 최소 1 개가 본문 토큰에 등장
 *
 * 너무 엄격하면 정상 제목까지 거르니까 단 하나의 토큰 overlap 만 요구.
 */
export function isTitleRelevant(title: string, content: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length === 0) return false;
  if (!isKoreanOutput(trimmed)) return false;
  for (const re of TITLE_DENY_PATTERNS) {
    if (re.test(trimmed)) return false;
  }
  const titleTokens = tokenize(trimmed);
  if (titleTokens.size === 0) return false;
  const contentTokens = tokenize(content);
  for (const t of titleTokens) {
    if (contentTokens.has(t)) return true;
  }
  return false;
}

/**
 * 본문에서 제목 fallback 을 만든다. AI 실패 시 사용.
 * 첫 줄을 가져와서 TITLE_HARD_CAP 자로 자른다.
 */
export function fallbackTitleFromContent(content: string): string {
  const firstLine = content.trim().split(/\r?\n/)[0].trim();
  if (firstLine.length === 0) return "제목 없음";
  if (firstLine.length <= TITLE_HARD_CAP) return firstLine;
  return `${firstLine.slice(0, TITLE_HARD_CAP - 1)}…`;
}

/**
 * /api/summarize 호출. admin 클라이언트가 사용.
 * 실패해도 throw 하지 않고 { title:null, summary:null } 반환 — 저장 흐름 안 막힘.
 */
export async function requestMeta(content: string): Promise<AiMeta> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return { title: null, summary: null };
    const json = (await res.json()) as Partial<AiMeta>;
    return {
      title: typeof json.title === "string" && json.title.trim().length > 0 ? json.title : null,
      summary: typeof json.summary === "string" && json.summary.trim().length > 0 ? json.summary : null,
    };
  } catch {
    return { title: null, summary: null };
  }
}
