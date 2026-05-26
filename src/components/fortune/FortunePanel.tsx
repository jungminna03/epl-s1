"use client";

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type FortuneFormData, type FortuneResult, fetchFortune } from "@/lib/fortune";
import FortuneInputCard from "./FortuneInputCard";
import FortuneLoading from "./FortuneLoading";
import FortuneResultCard from "./FortuneResultCard";

interface Props { onCloseFortune: () => void; }

export default function FortunePanel({ onCloseFortune }: Props) {
  const [view, setView] = useState<"input" | "loading" | "result">("input");
  const [form, setForm] = useState<FortuneFormData>({ gender: "", birthYear: "", birthMonth: "", birthDay: "", birthTime: "모름" });
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async () => {
    setView("loading"); setError(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetchFortune(form, ctrl.signal);
      setResult(res); setView("result");
    } catch (e: any) {
      if (e.name === "AbortError") { setView("input"); return; }
      setError(e.message); setView("input");
    } finally { abortRef.current = null; }
  }, [form]);

  const handleCancel = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setView("input");
  }, []);

  const handleBack = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    onCloseFortune();
  }, [onCloseFortune]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }} className="absolute inset-0 z-20 flex flex-col"
    >
      <AnimatePresence mode="wait">
        {view === "input" && (
          <motion.div key="fortune-input" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FortuneInputCard data={form} onChange={setForm} onSubmit={handleSubmit} onBack={handleBack} />
            {error && <div className="absolute inset-x-0 bottom-0 z-30 text-center" style={{ padding: "1vh 2vh" }}>
              <div className="rounded-[0.8vh] border border-red-400/30 bg-red-400/10 px-[1.5vh] py-[1vh] text-red-200" style={{ fontSize: "1.2vh" }}>{error}</div>
            </div>}
          </motion.div>
        )}
        {view === "loading" && (
          <motion.div key="fortune-loading" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FortuneLoading onCancel={handleCancel} />
          </motion.div>
        )}
        {view === "result" && result && (
          <motion.div key="fortune-result" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FortuneResultCard result={result} form={form} onRetry={() => setView("input")} onBack={handleBack} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
