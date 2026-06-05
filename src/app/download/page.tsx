import type { Metadata } from "next";
import Link from "next/link";

// 위젯 다운로드 랜딩 페이지 — GitHub Desktop 다운로드 페이지 콘셉트.
// 왼쪽 카피 + 다운로드 버튼, 오른쪽엔 실제 /widget 라이브 iframe 미리보기.
// 실제 파일 다운로드는 /download/latest (GitHub Releases 최신 .exe 302) 가 담당.

export const metadata: Metadata = {
  title: "위젯 다운로드 — 캠퍼스 공지사항",
  description: "바탕화면에서 바로 보는 캠퍼스 공지 위젯. Windows용 다운로드.",
};

const RELEASE_BASE =
  "https://github.com/jungminna03/epl-s1/releases/latest/download";

/**
 * latest.yml 에서 현재 배포 버전을 읽어온다. 실패해도 페이지는 정상 렌더 —
 * 버전 캡션만 생략된다. 10분 revalidate 라 릴리즈 후 늦어도 10분 안에 갱신.
 */
async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${RELEASE_BASE}/latest.yml`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const m = (await res.text()).match(/^version:\s*(.+?)\s*$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

export default async function DownloadPage() {
  const version = await getLatestVersion();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:justify-between lg:gap-16">
        {/* ─── 왼쪽: 카피 + 다운로드 버튼 ─── */}
        <div className="flex max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Campus Notice Widget
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-100 sm:text-5xl">
            바탕화면에서
            <br />
            바로 보는{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              공지사항
            </span>
          </h1>
          <p className="mt-5 leading-relaxed text-slate-400">
            설치하면 끝. 학과 공지가 실시간으로 바탕화면에 떠 있고,
            <br className="hidden sm:block" />
            새 버전은 자동으로 업데이트됩니다.
          </p>
          <a
            href="/download/latest"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 px-8 py-4 text-base font-semibold text-slate-900 shadow-[0_0_24px_rgba(34,211,238,0.35)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Windows용 다운로드
          </a>
          <p className="mt-3 text-sm text-slate-500">
            {version ? `v${version} · ` : ""}Windows 10/11
          </p>
          <Link
            href="/"
            className="mt-10 text-sm text-slate-500 transition hover:text-slate-300"
          >
            ← 메인으로
          </Link>
        </div>

        {/* ─── 오른쪽: 라이브 위젯 미리보기 ─── */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              // NoticeCard 와 같은 그라데이션 보더 톤
              background:
                "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(34,211,238,0.45), rgba(96,165,250,0.3), rgba(167,139,250,0.45)) border-box",
              border: "1.5px solid transparent",
              boxShadow: "0 0 60px rgba(96,165,250,0.12)",
            }}
          >
            {/* 실제 위젯 창 비율 그대로 (400×600). 순수 미리보기 — 클릭 차단 */}
            <iframe
              src="/widget"
              title="위젯 라이브 미리보기"
              className="pointer-events-none block h-[480px] w-[320px] sm:h-[600px] sm:w-[400px]"
            />
          </div>
          <p className="text-xs text-slate-600">
            ↑ 지금 올라와 있는 공지가 실시간으로 보이는 라이브 미리보기예요
          </p>
        </div>
      </div>
    </main>
  );
}
