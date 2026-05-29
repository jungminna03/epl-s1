"use client";

import { motion } from "framer-motion";
import { type CookieConcept, type CookieVariant, CONCEPTS } from "@/lib/cookie";

interface Props {
  onSelect: (concept: CookieConcept) => void;
  onBack: () => void;
  variant?: CookieVariant;
}

const T = {
  widget: {
    headerPad: "16px 12px 8px",
    title: "22px",
    desc: "12px",
    descMt: "4px",
    gridPad: "8px 12px",
    gridCols: "1fr 1fr 1fr" as const,
    gridGap: "8px",
    btnPad: "14px 6px",
    btnMinH: "72px",
    btnGap: "6px",
    btnRadius: "10px",
    icon: "26px",
    label: "13px",
    footerPad: "8px 12px 12px",
    footerGap: "6px",
    backPad: "10px 16px",
    backGap: "6px",
    backRadius: "8px",
    back: "13px",
  },
  display: {
    headerPad: "2.5vh 2vh 1vh",
    title: "3vh",
    desc: "1.4vh",
    descMt: "0.6vh",
    gridPad: "1.5vh 2.5vh",
    gridCols: "1fr 1fr" as const,
    gridGap: "1.2vh",
    btnPad: "2.5vh 1vh",
    btnMinH: "8vh",
    btnGap: "1vh",
    btnRadius: "1.2vh",
    icon: "4vh",
    label: "1.8vh",
    footerPad: "1.5vh 2.5vh 2vh",
    footerGap: "1vh",
    backPad: "1.6vh 2vh",
    backGap: "0.8vh",
    backRadius: "1vh",
    back: "1.5vh",
  },
};

export default function CookieSelectCard({
  onSelect,
  onBack,
  variant = "widget",
}: Props) {
  const t = T[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex h-full flex-col overflow-hidden"
      style={{
        borderRadius: variant === "widget" ? "12px" : "1.5vh",
        background:
          "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(251,191,36,0.45), rgba(251,191,36,0.3), rgba(245,158,11,0.45)) border-box",
        border: "1.5px solid transparent",
      }}
    >
      {/* Header */}
      <div className="shrink-0 text-center" style={{ padding: t.headerPad }}>
        <h2
          className="font-extrabold"
          style={{
            fontSize: t.title,
            background: "linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          🥠 포춘쿠키
        </h2>
        <p className="text-slate-400" style={{ fontSize: t.desc, marginTop: t.descMt }}>
          궁금한 주제를 선택하면 운세 포춘쿠키를 뽑아드려요.
        </p>
      </div>

      {/* Grid */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ padding: t.gridPad }}
      >
        <div
          className="grid w-full"
          style={{ gridTemplateColumns: t.gridCols, gap: t.gridGap }}
        >
          {CONCEPTS.map((c, i) => (
            <motion.button
              key={c.value}
              onClick={() => onSelect(c.value)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
              className="flex flex-col items-center justify-center border transition-all active:scale-[0.95] hover:brightness-125"
              style={{
                padding: t.btnPad,
                gap: t.btnGap,
                minHeight: t.btnMinH,
                borderRadius: t.btnRadius,
                background: `linear-gradient(135deg, rgba(15,18,25,0.9), rgba(15,18,25,0.6))`,
                border: `2px solid ${c.accent}44`,
              }}
            >
              <span style={{ fontSize: t.icon }}>{c.icon}</span>
              <span className="font-bold" style={{ fontSize: t.label, color: c.accent }}>
                {c.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="shrink-0 flex flex-col"
        style={{ padding: t.footerPad, gap: t.footerGap }}
      >
        <button
          onClick={onBack}
          className="flex w-full items-center justify-center border font-medium transition-all hover:bg-slate-800/50"
          style={{
            padding: t.backPad,
            gap: t.backGap,
            borderRadius: t.backRadius,
            borderColor: "rgba(148,163,184,0.15)",
            fontSize: t.back,
            color: "#94a3b8",
          }}
        >
          <span>←</span>
          <span>공지사항으로</span>
        </button>
      </div>
    </motion.div>
  );
}
