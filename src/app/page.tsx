import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
          Campus Notice Board
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-100">
          캠퍼스 공지사항
        </h1>
        <p className="mt-3 text-zinc-400">
          복도 디스플레이 및 관리자 페이지로 이동하세요.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/display"
          className="rounded-full bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
        >
          디스플레이 보기 →
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
        >
          관리자 로그인
        </Link>
      </div>
    </main>
  );
}
