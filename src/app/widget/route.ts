// 호환용: 0.1.0 인스톨러에 widgetUrl=/widget 가 박혀있는데 widget/page.tsx 가
// 삭제되면서 영구 404 가 되었다. 새 위치인 /display 로 308(영구) 리다이렉트.
// 이 라우트는 절대 지우면 안 됨 — 야생에 풀린 0.1.0 위젯이 이걸 의지하고 있음.

export function GET(req: Request) {
  const url = new URL(req.url);
  url.pathname = "/display";
  return Response.redirect(url.toString(), 308);
}
