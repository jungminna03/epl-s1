"use client";

// 데스크톱 위젯 전용 라우트. /display 가 사이니지(전체 화면)용이라면
// 여기는 작은 폼팩터(예: 400x600)에서 보일 위젯 UI 가 들어갈 자리.
// 디자인은 사용자 작업 예정 — 현재는 placeholder.

export default function WidgetPage() {
  return (
    <main className="flex h-screen w-screen items-center justify-center bg-[#0f1219] text-slate-300">
      <div className="px-6 text-center">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.3em]"
          style={{
            background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          EPL Widget
        </div>
        <div className="mt-3 text-sm font-medium text-slate-200">
          위젯 디자인 작업 중
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          /display 에서 사이니지 화면 확인 가능
        </div>
      </div>
    </main>
  );
}
