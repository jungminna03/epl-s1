"use client";

import { motion } from "framer-motion";

interface Props { onCancel?: () => void; }

export default function FortuneLoading({ onCancel }: Props) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      className="flex h-full flex-col items-center justify-center rounded-[1.5vh]"
      style={{ background: "rgba(15,18,25,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      <div className="relative" style={{ width: "6vh", height: "6vh" }}>
        <motion.div className="absolute inset-0 rounded-full"
          style={{ border: "2px solid transparent", borderTopColor: "#a78bfa", borderRightColor: "#22d3ee" }}
          animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
        <motion.div className="absolute rounded-full"
          style={{ inset: "0.8vh", border: "2px solid transparent", borderBottomColor: "#c084fc", borderLeftColor: "#60a5fa" }}
          animate={{ rotate: -360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
      </div>
      <div className="text-center" style={{ marginTop: "2vh" }}>
        <p className="font-bold text-slate-200" style={{ fontSize: "3.2vh", background: "linear-gradient(90deg, #a78bfa, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>운세를 풀이하는 중...</p>
        <p className="text-slate-500" style={{ fontSize: "2.2vh", marginTop: "0.6vh" }}>잠시만 기다려주세요</p>
      </div>
      {onCancel && (
        <button onClick={onCancel} className="mt-[2vh] rounded-full border px-[1.5vh] py-[0.6vh] text-slate-400 transition-all hover:text-slate-200"
          style={{ borderColor: "rgba(148,163,184,0.15)", fontSize: "2.2vh" }}
        >취소</button>
      )}
    </motion.div>
  );
}
