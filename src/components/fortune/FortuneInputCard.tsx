"use client";

import { motion } from "framer-motion";
import { type FortuneFormData, getYearOptions, getMonthOptions, getDayOptions, TIME_SLOTS, TIME_UNKNOWN, isFortuneFormValid } from "@/lib/fortune";

interface Props { data: FortuneFormData; onChange: (data: FortuneFormData) => void; onSubmit: () => void; onBack: () => void; }

const selectBase = "appearance-none rounded-[0.8vh] border bg-[#1e293b] px-[1.2vh] py-[0.8vh] text-slate-200 outline-none transition focus:border-purple-400/50";

export default function FortuneInputCard({ data, onChange, onSubmit, onBack }: Props) {
  const valid = isFortuneFormValid(data);
  const update = (patch: Partial<FortuneFormData>) => onChange({ ...data, ...patch });

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex h-full flex-col overflow-hidden rounded-[1.5vh]"
      style={{
        background: "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(167,139,250,0.45), rgba(34,211,238,0.3), rgba(139,92,246,0.45)) border-box",
        border: "1.5px solid transparent",
      }}
    >
      <div className="shrink-0 text-center" style={{ padding: "2.5vh 2vh 1vh" }}>
        <h2 className="font-extrabold" style={{
          fontSize: "6vh",
          background: "linear-gradient(90deg, #a78bfa, #22d3ee, #c084fc)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>🔮 오늘의 운세</h2>
        <p className="text-slate-400" style={{ fontSize: "2.6vh", marginTop: "0.8vh" }}>생년월일과 태어난 시간을 입력하면 오늘의 운세를 알려드립니다.</p>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: "1.5vh 2.5vh" }}>
        <div className="flex flex-col" style={{ gap: "1.8vh" }}>
          <div className="flex flex-col" style={{ gap: "0.5vh" }}>
            <label className="font-semibold text-slate-300" style={{ fontSize: "2.4vh" }}>성별</label>
            <select value={data.gender} onChange={(e) => update({ gender: e.target.value as any })}
              className={selectBase} style={{ borderColor: "rgba(167,139,250,0.2)", fontSize: "2.8vh" }}
            >
              <option value="">선택해주세요</option><option value="male">남성</option><option value="female">여성</option>
            </select>
          </div>

          <div className="flex flex-col" style={{ gap: "0.5vh" }}>
            <label className="font-semibold text-slate-300" style={{ fontSize: "2.4vh" }}>생년월일</label>
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr 1fr", gap: "0.8vh" }}>
              <select value={data.birthYear} onChange={(e) => update({ birthYear: Number(e.target.value) || "" })}
                className={selectBase} style={{ borderColor: "rgba(167,139,250,0.2)", fontSize: "2.8vh" }}
              >
                <option value="">년</option>{getYearOptions().map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={data.birthMonth} onChange={(e) => update({ birthMonth: Number(e.target.value) || "" })}
                className={selectBase} style={{ borderColor: "rgba(167,139,250,0.2)", fontSize: "2.8vh" }}
              >
                <option value="">월</option>{getMonthOptions().map((m) => <option key={m} value={m}>{m}월</option>)}
              </select>
              <select value={data.birthDay} onChange={(e) => update({ birthDay: Number(e.target.value) || "" })}
                className={selectBase} style={{ borderColor: "rgba(167,139,250,0.2)", fontSize: "2.8vh" }}
              >
                <option value="">일</option>{getDayOptions().map((d) => <option key={d} value={d}>{d}일</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col" style={{ gap: "0.5vh" }}>
            <label className="font-semibold text-slate-300" style={{ fontSize: "2.4vh" }}>태어난 시간</label>
            <select value={data.birthTime} onChange={(e) => update({ birthTime: e.target.value })}
              className={selectBase} style={{ borderColor: "rgba(167,139,250,0.2)", fontSize: "2.8vh" }}
            >
              {[{ value: TIME_UNKNOWN, label: "모름", range: "" }, ...TIME_SLOTS].map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value === TIME_UNKNOWN ? "모름" : `${t.label} ${t.range}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="shrink-0 flex flex-col" style={{ padding: "1.5vh 2.5vh 2vh", gap: "1vh" }}>
        <button onClick={onSubmit} disabled={!valid}
          className="flex w-full items-center justify-center rounded-[1vh] border font-bold transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
          style={{
            padding: "1.6vh 2vh", gap: "0.8vh",
            background: "linear-gradient(135deg, rgba(167,139,250,0.2), rgba(34,211,238,0.15))",
            borderColor: "rgba(167,139,250,0.3)",
            color: valid ? "#e2e8f0" : "#94a3b8", fontSize: "3vh",
          }}
        ><span>✨</span><span>운세 보기</span></button>
        <button onClick={onBack}
          className="flex w-full items-center justify-center rounded-[1vh] border font-medium transition-all hover:bg-slate-800/50"
          style={{ padding: "1.2vh 2vh", gap: "0.6vh", borderColor: "rgba(148,163,184,0.15)", fontSize: "2.4vh", color: "#94a3b8" }}
        ><span>←</span><span>공지사항으로</span></button>
      </div>
    </motion.div>
  );
}
