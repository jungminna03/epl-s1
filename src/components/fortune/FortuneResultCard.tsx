"use client";

import { motion } from "framer-motion";
import { type FortuneResult, type FortuneFormData, genderLabel } from "@/lib/fortune";

interface Props { result: FortuneResult; form: FortuneFormData; onBack: () => void; }

export default function FortuneResultCard({ result, form, onBack }: Props) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][today.getDay()];

  const userInfo = [genderLabel(form.gender), form.birthYear !== "" ? `${form.birthYear}년생` : "", form.birthTime && form.birthTime !== "모름" ? form.birthTime : ""].filter(Boolean).join(" · ");

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col overflow-hidden rounded-[1.5vh]"
      style={{
        background: "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(167,139,250,0.45), rgba(34,211,238,0.3), rgba(139,92,246,0.45)) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="shrink-0 text-center" style={{ padding: "2.5vh 2vh 1vh" }}>
        <h2 className="font-extrabold" style={{
          fontSize: "2.5vh",
          background: "linear-gradient(90deg, #a78bfa, #22d3ee, #c084fc)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>✨ 오늘의 운세 결과</h2>
        <p className="text-slate-400" style={{ fontSize: "1.2vh", marginTop: "0.6vh" }}>{dateStr} ({weekday}요일)</p>
        {userInfo && <p className="text-slate-500" style={{ fontSize: "1vh", marginTop: "0.4vh" }}>{userInfo}</p>}
      </div>

      <div className="shrink-0 text-center" style={{ padding: "1vh 0" }}>
        <span className="font-bold" style={{
          fontSize: "4vh",
          background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 0.5vh rgba(251,191,36,0.3))",
        }}>{result.stars}</span>
      </div>

      <div ref={(el) => { if (el) el.scrollTop = 0; }} className="relative z-10 flex-1 overflow-y-auto" style={{ padding: "0 2.5vh 1vh" }}>
        <div className="whitespace-pre-line text-slate-200 leading-[1.7]" style={{ fontSize: "1.4vh" }}>{result.fullText}</div>
        <div className="mt-[2vh] flex flex-wrap" style={{ gap: "0.8vh" }}>
          {result.luckyColor && <LuckyBadge icon="🎨" label="색상" value={result.luckyColor} />}
          {result.luckyDirection && <LuckyBadge icon="🧭" label="방위" value={result.luckyDirection} />}
          {result.luckyNumber && <LuckyBadge icon="🔢" label="숫자" value={result.luckyNumber} />}
        </div>
      </div>

      <div className="shrink-0 flex flex-col" style={{ padding: "1.5vh 2.5vh 2vh", gap: "1vh" }}>
        <button onClick={onBack} className="flex w-full items-center justify-center rounded-[1vh] border font-medium transition-all hover:bg-slate-800/50"
          style={{ padding: "1.2vh 2vh", gap: "0.6vh", borderColor: "rgba(148,163,184,0.15)", fontSize: "1.3vh", color: "#94a3b8" }}
        ><span>←</span><span>공지사항으로</span></button>
      </div>
    </motion.div>
  );
}

function LuckyBadge({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center rounded-full border"
      style={{ padding: "0.4vh 1.2vh", gap: "0.5vh", background: "rgba(167,139,250,0.08)", borderColor: "rgba(167,139,250,0.2)" }}
    >
      <span style={{ fontSize: "1.2vh" }}>{icon}</span>
      <span className="text-slate-400" style={{ fontSize: "1.1vh" }}>{label}</span>
      <span className="font-semibold text-purple-300" style={{ fontSize: "1.2vh" }}>{value}</span>
    </div>
  );
}
