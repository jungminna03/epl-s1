"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  RELEASE_ENTRIES,
  LATEST_VERSION,
  markSeen,
  type ReleaseTag,
} from "@/lib/release-notes";

interface Props {
  onClose: () => void;
}

const TAG_STYLE: Record<ReleaseTag, string> = {
  ADD:      "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
  UPDATE:   "text-sky-300 bg-sky-400/10 border-sky-400/30",
  FIX:      "text-amber-300 bg-amber-400/10 border-amber-400/30",
  REFACTOR: "text-violet-300 bg-violet-400/10 border-violet-400/30",
  REMOVE:   "text-rose-300 bg-rose-400/10 border-rose-400/30",
  PERF:     "text-pink-300 bg-pink-400/10 border-pink-400/30",
  CHORE:    "text-zinc-300 bg-zinc-400/10 border-zinc-400/30",
};

const ENTRY_BORDER: Record<ReleaseTag, string> = {
  ADD: "border-l-emerald-400/60",
  UPDATE: "border-l-sky-400/60",
  FIX: "border-l-amber-400/60",
  REFACTOR: "border-l-violet-400/60",
  REMOVE: "border-l-rose-400/60",
  PERF: "border-l-pink-400/60",
  CHORE: "border-l-zinc-400/60",
};

export default function ReleaseNotesPanel({ onClose }: Props) {
  // 패널을 본 시점에 최신 버전을 'seen' 으로 기록 → 동그라미 pulse 해제.
  useEffect(() => {
    markSeen(LATEST_VERSION);
  }, []);

  // ESC 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* dialog */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-notes-title"
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Release Notes
            </p>
            <h2
              id="release-notes-title"
              className="mt-1 text-xl font-semibold text-zinc-50"
            >
              업데이트 내역
            </h2>
            <p className="mt-1 text-xs text-cyan-300">
              최신 {LATEST_VERSION}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ul className="space-y-6">
            {RELEASE_ENTRIES.map((entry) => (
              <li key={entry.version}>
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-bold text-zinc-100">
                    {entry.version}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {entry.date}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {entry.items.map((item, idx) => (
                    <li
                      key={idx}
                      className={[
                        "flex items-start gap-3 rounded-md border-l-2 bg-white/[0.02] px-3 py-2.5",
                        ENTRY_BORDER[item.tag],
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-flex shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
                          TAG_STYLE[item.tag],
                        ].join(" ")}
                      >
                        {item.tag}
                      </span>
                      <span className="text-sm leading-relaxed text-zinc-200">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
}
