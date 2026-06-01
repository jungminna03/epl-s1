"use client";

import { useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type CookieResult, type CookieConcept, type CookieView, type CookieVariant, fetchCookie } from "@/lib/cookie";
import CookieSelectCard from "./CookieSelectCard";
import CookieLoading from "./CookieLoading";
import CookieResultCard from "./CookieResultCard";

interface Props { onCloseCookie: () => void; variant?: CookieVariant; }

export default function CookiePanel({ onCloseCookie, variant = "widget" }: Props) {
  const [view, setView] = useState<CookieView>("select");
  const [result, setResult] = useState<CookieResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startCookie = useCallback(async (concept: CookieConcept) => {
    setView("loading"); setError(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await fetchCookie(concept, ctrl.signal);
      setResult(res); setView("result");
    } catch (e: any) {
      if (e.name === "AbortError") { setView("select"); return; }
      setError(e.message); setView("select");
    } finally { abortRef.current = null; }
  }, []);

  const handleCancel = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setView("select");
  }, []);

  const handleBack = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    onCloseCookie();
  }, [onCloseCookie]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <AnimatePresence mode="wait">
        {view === "select" && (
          <motion.div key="cookie-select" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CookieSelectCard onSelect={startCookie} onBack={handleBack} variant={variant} />
            {error && <div className="absolute inset-x-0 bottom-0 z-30 text-center" style={{ padding: "1vh 2vh" }}>
              <div className="rounded-[0.8vh] border border-red-400/30 bg-red-400/10 px-[1.5vh] py-[1vh] text-red-200" style={{ fontSize: "1.2vh" }}>{error}</div>
            </div>}
          </motion.div>
        )}
        {view === "loading" && (
          <motion.div key="cookie-loading" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CookieLoading onCancel={handleCancel} variant={variant} />
          </motion.div>
        )}
        {view === "result" && result && (
          <motion.div key="cookie-result" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CookieResultCard result={result} onBack={handleBack} variant={variant} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
