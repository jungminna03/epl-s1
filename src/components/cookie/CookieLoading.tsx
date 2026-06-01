"use client";

import { motion } from "framer-motion";
import { type CookieVariant } from "@/lib/cookie";

interface Props {
  onCancel?: () => void;
  variant?: CookieVariant;
}

const T = {
  widget: {
    spinner: "48px",
    inset: "6px",
    title: "16px",
    desc: "12px",
    descMt: "12px",
    cancel: "12px",
    cancelMt: "16px",
  },
  display: {
    spinner: "6vh",
    inset: "0.8vh",
    title: "1.6vh",
    desc: "1.1vh",
    descMt: "2vh",
    cancel: "1.1vh",
    cancelMt: "2vh",
  },
};

export default function CookieLoading({ onCancel, variant = "widget" }: Props) {
  const t = T[variant];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col items-center justify-center"
      style={{
        borderRadius: variant === "widget" ? "12px" : "1.5vh",
        background: "rgba(15,18,25,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div className="relative" style={{ width: t.spinner, height: t.spinner }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: "2px solid transparent",
            borderTopColor: "#fbbf24",
            borderRightColor: "#f59e0b",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            inset: t.inset,
            border: "2px solid transparent",
            borderBottomColor: "#d97706",
            borderLeftColor: "#fbbf24",
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div className="text-center" style={{ marginTop: t.descMt }}>
        <p
          className="font-bold text-slate-200"
          style={{
            fontSize: t.title,
            background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          포춘쿠키를 열어 보는 중...
        </p>
        <p className="text-slate-500" style={{ fontSize: t.desc, marginTop: "4px" }}>
          잠시만 기다려주세요
        </p>
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="rounded-full border px-[1.5vh] py-[0.6vh] text-slate-400 transition-all hover:text-slate-200"
          style={{ borderColor: "rgba(148,163,184,0.15)", fontSize: t.cancel, marginTop: t.cancelMt }}
        >
          취소
        </button>
      )}
    </motion.div>
  );
}
