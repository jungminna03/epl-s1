"use client";

import FortunePanel from "@/components/fortune/FortunePanel";

export default function FortuneTestPage() {
  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: "#0f1219", padding: "2vh" }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[2vh] border border-slate-700/50">
        <FortunePanel onCloseFortune={() => console.log("close")} />
      </div>
    </main>
  );
}
