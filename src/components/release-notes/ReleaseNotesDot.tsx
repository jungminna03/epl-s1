"use client";

interface Props {
  hasUnseen: boolean;
  onClick: () => void;
}

/**
 * 관리자 페이지 좌하단 동그라미. 새 버전이 있으면 cyan + pulse, 봤으면 회색.
 * 뷰포트 기준 고정(fixed) — 페이지 스크롤과 무관하게 항상 좌하단.
 */
export default function ReleaseNotesDot({ hasUnseen, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasUnseen ? "새 업데이트 내역 보기" : "업데이트 내역 보기"}
      title={hasUnseen ? "새 업데이트가 있어요" : "업데이트 내역"}
      className={[
        "fixed bottom-5 left-5 z-40 flex h-11 w-11 items-center justify-center rounded-full",
        "transition-transform active:scale-90 hover:scale-105",
        hasUnseen
          ? "bg-gradient-to-br from-cyan-300 to-cyan-600 shadow-[0_0_24px_rgba(34,211,238,0.55)] ring-1 ring-cyan-300/60 animate-rn-pulse"
          : "bg-zinc-800 ring-1 ring-zinc-700 hover:bg-zinc-700",
      ].join(" ")}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={hasUnseen ? "#082f49" : "#a1a1aa"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
      <style jsx>{`
        @keyframes rn-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        :global(.animate-rn-pulse) {
          animation: rn-pulse 2.4s ease-in-out infinite;
        }
      `}</style>
    </button>
  );
}
