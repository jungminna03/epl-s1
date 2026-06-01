"use client";

import CookiePanel from "@/components/cookie/CookiePanel";

export default function CookieTestPage() {
  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: "#0f1219", padding: "2vh" }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[2vh] border border-slate-700/50">
        <CookiePanel onCloseCookie={() => console.log("close")} />
      </div>
    </main>
  );
}
