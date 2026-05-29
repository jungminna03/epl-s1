"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { type CookieResult, type CookieVariant } from "@/lib/cookie";

interface Props {
  result: CookieResult;
  onBack: () => void;
  variant?: CookieVariant;
}

const T = {
  widget: {
    radius: "12px",
    headerPad: "16px 12px 8px",
    title: "22px",
    desc: "12px",
    descMt: "4px",
    contentPad: "0 16px",
    cookie: "80px",
    clickText: "12px",
    clickMt: "8px",
    paperMaxW: "320px",
    paperPad: "16px 12px",
    paperRadius: "10px",
    message: "14px",
    kwMt: "10px",
    kwGap: "6px",
    kwPad: "4px 10px",
    kw: "11px",
    footerPad: "12px 16px 16px",
    footerGap: "8px",
    btnPad: "12px 16px",
    btnGap: "6px",
    btnRadius: "8px",
    btn: "14px",
  },
  display: {
    radius: "1.5vh",
    headerPad: "2.5vh 2vh 1vh",
    title: "2.5vh",
    desc: "1.2vh",
    descMt: "0.6vh",
    contentPad: "0 2.5vh",
    cookie: "12vh",
    clickText: "1.3vh",
    clickMt: "1vh",
    paperMaxW: "42vh",
    paperPad: "2.5vh 2vh",
    paperRadius: "1.2vh",
    message: "2.2vh",
    kwMt: "1.5vh",
    kwGap: "0.8vh",
    kwPad: "0.5vh 1.2vh",
    kw: "1.2vh",
    footerPad: "1.5vh 2.5vh 2vh",
    footerGap: "1vh",
    btnPad: "1.6vh 2vh",
    btnGap: "0.8vh",
    btnRadius: "1vh",
    btn: "1.5vh",
  },
};

export default function CookieResultCard({
  result,
  onBack,
  variant = "widget",
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const t = T[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col overflow-hidden"
      style={{
        borderRadius: t.radius,
        background:
          "linear-gradient(#0f1219, #0f1219) padding-box, linear-gradient(135deg, rgba(251,191,36,0.45), rgba(245,158,11,0.3), rgba(251,191,36,0.45)) border-box",
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
        {!revealed && (
          <p className="text-slate-400" style={{ fontSize: t.desc, marginTop: t.descMt }}>
            쿠키를 끼워 보세요!
          </p>
        )}
      </div>

      {/* Cookie / Message Area */}
      <div
        className="relative flex-1 flex flex-col items-center justify-center overflow-hidden"
        style={{ padding: t.contentPad }}
      >
        {!revealed ? (
          <motion.button
            onClick={() => setRevealed(true)}
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <div
              className="absolute -inset-[20%] rounded-full opacity-20"
              style={{
                background:
                  "radial-gradient(circle, rgba(251,191,36,0.4), transparent 70%)",
              }}
            />
            <span
              style={{
                fontSize: t.cookie,
                filter: "drop-shadow(0 0 1vh rgba(251,191,36,0.3))",
              }}
            >
              🥠
            </span>
            <p
              className="text-slate-400 text-center"
              style={{ fontSize: t.clickText, marginTop: t.clickMt }}
            >
              클릭해서 열어보기
            </p>
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateX: 30 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            {/* Fortune paper */}
            <div
              className="relative w-full border"
              style={{
                maxWidth: t.paperMaxW,
                padding: t.paperPad,
                borderRadius: t.paperRadius,
                background:
                  "linear-gradient(180deg, rgba(251,191,36,0.08), rgba(245,158,11,0.04))",
                borderColor: "rgba(251,191,36,0.2)",
              }}
            >
              <div
                className="absolute top-2 left-4 right-4 h-[1px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)",
                }}
              />
              <p
                className="text-center font-bold text-slate-100 leading-[1.7]"
                style={{ fontSize: t.message, letterSpacing: "0.02vh" }}
              >
                {result.message}
              </p>
              <div
                className="absolute bottom-2 left-4 right-4 h-[1px]"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)",
                }}
              />
            </div>

            {/* Keywords */}
            {result.keywords.length > 0 && (
              <div
                className="flex flex-wrap justify-center"
                style={{ marginTop: t.kwMt, gap: t.kwGap }}
              >
                {result.keywords.map((k, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="inline-flex items-center rounded-full border font-semibold"
                    style={{
                      padding: t.kwPad,
                      background: "rgba(251,191,36,0.08)",
                      borderColor: "rgba(251,191,36,0.25)",
                      fontSize: t.kw,
                      color: "#fbbf24",
                      gap: "0.3vh",
                    }}
                  >
                    <span>🔑</span>
                    <span>{k}</span>
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer button — only after reveal */}
      {revealed && (
        <div
          className="shrink-0 flex flex-col"
          style={{ padding: t.footerPad, gap: t.footerGap }}
        >
          <button
            onClick={onBack}
            className="flex w-full items-center justify-center border font-bold transition-all active:scale-[0.97]"
            style={{
              padding: t.btnPad,
              gap: t.btnGap,
              borderRadius: t.btnRadius,
              background:
                "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.1))",
              borderColor: "rgba(251,191,36,0.3)",
              color: "#e2e8f0",
              fontSize: t.btn,
            }}
          >
            <span>✓</span>
            <span>확인했어요</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}
