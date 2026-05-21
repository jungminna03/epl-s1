// `/download` → GitHub Releases 의 최신 인스톨러로 302 리다이렉트.
// electron-updater 의 latest.yml 을 그대로 진실 공급원(SoT)으로 쓰면
// 릴리즈마다 이 코드를 만질 필요가 없다 — gh release 가 새 .exe + latest.yml 을
// 같이 올리고 나면 다음 요청부터 자동으로 새 파일을 가리킨다.

const RELEASE_BASE = "https://github.com/jungminna03/epl-s1/releases/latest/download";

export const dynamic = "force-dynamic";

export async function GET() {
  let yml: string;
  try {
    const res = await fetch(`${RELEASE_BASE}/latest.yml`, { cache: "no-store" });
    if (!res.ok) {
      return new Response(
        `latest.yml fetch failed: ${res.status} ${res.statusText}`,
        { status: 502 },
      );
    }
    yml = await res.text();
  } catch (err) {
    return new Response(
      `latest.yml fetch error: ${(err as Error).message}`,
      { status: 502 },
    );
  }

  const m = yml.match(/^path:\s*(.+?)\s*$/m);
  if (!m) {
    return new Response("latest.yml에 path 필드가 없습니다.", { status: 502 });
  }

  const filename = m[1].trim().replace(/^["']|["']$/g, "");
  const target = `${RELEASE_BASE}/${encodeURIComponent(filename)}`;

  return Response.redirect(target, 302);
}
