"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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

  // 배포 모드에서 위젯 창은 `focusable:false` + focus→blur 정책으로 절대 포커스를
  // 잡지 못한다 (의도: 다른 창 뒤로 가려져 있어야 함). 그런데 운세 패널의 native
  // `<select>` 드롭다운은 윈도우가 포커스를 잡아야만 popup 이 열린다. 패널이 열린
  // 동안만 한시적으로 focusable 을 풀고, 닫힐 때 원복한다. dev 모드는 no-op.
  useEffect(() => {
    const epl = typeof window !== "undefined"
      ? (window as Window & { epl?: { setFocusable?: (v: boolean) => void } }).epl
      : undefined;
    epl?.setFocusable?.(true);
    return () => {
      epl?.setFocusable?.(false);
    };
  }, []);

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
              <div className="rounded-[0.8vh] border border-red-400/30 bg-red-400/10 px-[1.5vh] py-[1vh] text-red-200" style={{ fontSize: "2.2vh" }}>{error}</div>
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
            <FortuneResultCard result={result} form={form} onBack={handleBack} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
