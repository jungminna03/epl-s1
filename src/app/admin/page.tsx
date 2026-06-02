"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { id } from "@instantdb/react";
import {
  CATEGORIES,
  db,
  type Category,
  type Notice,
} from "@/lib/instant";
import {
  AUTO_PERIOD_DAYS,
  CATEGORY_STYLES,
  DEFAULT_STYLE,
  formatAbsolute,
  getEffectivePeriod,
  parseCategories,
} from "@/lib/categories";
import {
  MIN_CONTENT_LENGTH,
  SUMMARY_HARD_CAP,
  requestSummary,
} from "@/lib/ai-summary";

/**
 * /admin
 *
 * 비밀번호 게이트(클라이언트 sessionStorage) → 대시보드.
 * 모든 mutation 은 db.transact 로 프론트에서 직접 처리.
 */
export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setAuthed(sessionStorage.getItem("admin_authed") === "1");
  }, []);

  // 첫 렌더(SSR)와 클라이언트 렌더 차이를 막기 위해 hydration 후에만 분기
  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  if (!authed) {
    return <AuthGate onSuccess={() => setAuthed(true)} />;
  }

  return <Dashboard onSignOut={() => setAuthed(false)} />;
}

/* -------------------------------------------------------------------------- */
/*  Password Gate                                                              */
/* -------------------------------------------------------------------------- */

const ADMIN_PASSWORD = "epls1";

function AuthGate({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_authed", "1");
      onSuccess();
    } else {
      setError("비밀번호가 올바르지 않습니다.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-white/5 bg-zinc-900/70 p-8 shadow-2xl backdrop-blur"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50">
          관리자 로그인
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          비밀번호를 입력하세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoFocus
              placeholder="••••••••"
              className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
            />
          </div>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
          >
            입장
          </button>
        </form>
      </motion.div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

/** "YYYY-MM-DD" → ms timestamp at midnight */
function dateToMs(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getTime();
}

/** ms timestamp → "YYYY-MM-DD" */
function msToDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface FormState {
  id: string | null; // null 이면 새 공지
  title: string;
  content: string;
  category: string; // 쉼표 구분 다중 카테고리 (e.g. "1학년,3학년")
  link: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "" means 무기한
  /** edit 모드 진입 시점의 content. 저장 시 비교해서 변경 없으면 요약 재사용. 새 공지는 빈 문자열. */
  originalContent: string;
  /** edit 모드 진입 시점의 summary. content 가 그대로면 이 값을 그대로 transact 에 포함. */
  originalSummary: string | null;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  content: "",
  category: "",
  link: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  originalContent: "",
  originalSummary: null,
};

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "form">("list");
  const [layoutMode, setLayoutMode] = useState<"desktop" | "touch">(
    typeof window !== "undefined" ? (window.innerWidth >= 1280 ? "desktop" : "touch") : "touch"
  );

  useEffect(() => {
    function handleResize() {
      setLayoutMode(window.innerWidth >= 1280 ? "desktop" : "touch");
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const editing = form.id !== null;
  const notices: Notice[] = useMemo(() => data?.notices ?? [], [data]);

  function startEdit(n: Notice) {
    setForm({
      id: n.id,
      title: n.title,
      content: n.content,
      category: n.category ?? "",
      link: n.link ?? "",
      startDate: n.startDate ? msToDate(n.startDate) : msToDate(n.createdAt),
      endDate: n.endDate ? msToDate(n.endDate) : "",
      originalContent: n.content,
      originalSummary: (n as Notice & { summary?: string | null }).summary ?? null,
    });
    setMobileView("form");
  }

  function reset() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = form.title.trim();
    const trimmedContent = form.content.trim();
    if (!trimmedTitle || !trimmedContent) {
      return;
    }
    setSubmitting(true);
    try {
      // 본문이 그대로면 기존 summary 재사용 — 토큰 낭비 방지.
      const contentUnchanged =
        editing && trimmedContent === form.originalContent.trim();
      let summary: string | null;
      if (contentUnchanged) {
        summary = form.originalSummary;
      } else {
        summary = await requestSummary(trimmedTitle, trimmedContent);
      }

      if (editing && form.id) {
        await db.transact(
          db.tx.notices[form.id].update({
            title: trimmedTitle,
            content: trimmedContent,
            category: form.category || "",
            link: form.link.trim() || null,
            startDate: dateToMs(form.startDate),
            endDate: form.endDate ? dateToMs(form.endDate) : null,
            summary: summary,
          }),
        );
      } else {
        await db.transact(
          db.tx.notices[id()].update({
            title: trimmedTitle,
            content: trimmedContent,
            category: form.category || "",
            link: form.link.trim() || null,
            createdAt: Date.now(),
            startDate: dateToMs(form.startDate),
            endDate: form.endDate ? dateToMs(form.endDate) : null,
            summary: summary,
          }),
        );
      }
      reset();
      setMobileView("list");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(n: Notice) {
    const ok = window.confirm(`"${n.title}" 공지를 삭제할까요?`);
    if (!ok) return;
    await db.transact(db.tx.notices[n.id].delete());
    if (form.id === n.id) reset();
  }

  function handleSignOut() {
    sessionStorage.removeItem("admin_authed");
    onSignOut();
  }

  const showAISummaryLoader =
    submitting &&
    !(editing && form.content.trim() === form.originalContent.trim());

  return (
    <main className="min-h-screen overflow-x-hidden">
      <AnimatePresence>
        {showAISummaryLoader && <AISummaryLoadingOverlay />}
      </AnimatePresence>
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-6 lg:py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Admin Dashboard
            </p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-50">
              공지사항 관리
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <BackfillSummariesButton notices={notices} />
            <a
              href="/display"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              디스플레이 미리보기 ↗
            </a>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-red-500/60 hover:text-red-300"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* ── Desktop (mouse + fine pointer) ── */}
      {(layoutMode === "desktop" || layoutMode === null) && (
        <div className="mx-auto w-full max-w-6xl grid-cols-[1fr_400px] gap-6 px-6 py-8 lg:grid">
          {/* List */}
          <section>
            <SectionHeader
              title="등록된 공지"
              subtitle={`총 ${notices.length}건`}
            />
            {isLoading ? (
              <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
            ) : error ? (
              <p className="mt-4 text-sm text-red-400">{error.message}</p>
            ) : notices.length === 0 ? (
              <EmptyList />
            ) : (
              <ul className="mt-4 space-y-3">
                <AnimatePresence initial={false}>
                  {notices.map((n) => (
                    <NoticeRow
                      key={n.id}
                      notice={n}
                      active={form.id === n.id}
                      onEdit={() => startEdit(n)}
                      onDelete={() => handleDelete(n)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>

          {/* Form */}
          <aside className="sticky top-6 self-start">
            <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6 backdrop-blur">
              <SectionHeader
                title={editing ? "공지 수정" : "새 공지 작성"}
                subtitle={editing ? "선택된 공지를 수정합니다" : undefined}
              />
              <NoticeForm
                form={form}
                setForm={setForm}
                editing={editing}
                submitting={submitting}
                onSubmit={handleSubmit}
                onReset={reset}
                onBack={editing ? () => { reset(); setMobileView("list"); } : undefined}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ── Touch (mobile + tablet) ── */}
      {layoutMode === "touch" && (
        <div>
          {mobileView === "list" ? (
            <MobileListView
              notices={notices}
              isLoading={isLoading}
              error={error}
              onEdit={startEdit}
              onDelete={handleDelete}
              onCreate={() => { reset(); setMobileView("form"); }}
            />
          ) : (
            <MobileFormView
              form={form}
              setForm={setForm}
              editing={editing}
              submitting={submitting}
              onSubmit={handleSubmit}
              onReset={reset}
              onBack={() => { reset(); setMobileView("list"); }}
            />
          )}
        </div>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

function AISummaryLoadingOverlay() {
  // 무작위해 보이지만 SSR/CSR 가 동일하게 그려지도록 고정 좌표 사용
  const sparkles = [
    { top: "18%", left: "22%", delay: 0, size: 6 },
    { top: "28%", left: "78%", delay: 0.4, size: 4 },
    { top: "62%", left: "14%", delay: 0.8, size: 5 },
    { top: "72%", left: "82%", delay: 1.2, size: 7 },
    { top: "44%", left: "10%", delay: 0.2, size: 3 },
    { top: "52%", left: "90%", delay: 1.0, size: 4 },
    { top: "12%", left: "52%", delay: 0.6, size: 5 },
    { top: "84%", left: "48%", delay: 1.4, size: 4 },
  ];

  return (
    <motion.div
      key="ai-summary-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: "rgba(9, 11, 17, 0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {/* 배경의 반짝이는 별들 */}
      <div className="pointer-events-none absolute inset-0">
        {sparkles.map((s, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.4, 1.2, 0.4],
              rotate: [0, 180],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: s.delay,
              ease: "easeInOut",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
              <path
                d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z"
                fill="url(#sparkleGrad)"
              />
              <defs>
                <linearGradient id="sparkleGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        ))}
      </div>

      {/* 중앙 스피너 + 텍스트 */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative flex flex-col items-center"
      >
        <div className="relative h-28 w-28">
          {/* 바깥 회전 링 */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: "2px solid transparent",
              borderTopColor: "#a78bfa",
              borderRightColor: "#22d3ee",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
          {/* 안쪽 역회전 링 */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: 14,
              border: "2px solid transparent",
              borderBottomColor: "#c084fc",
              borderLeftColor: "#60a5fa",
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "linear" }}
          />
          {/* 가운데 펄스하는 별 */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.15, 1], rotate: [0, 12, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none">
              <path
                d="M12 1 L14 9.5 L22.5 12 L14 14.5 L12 23 L10 14.5 L1.5 12 L10 9.5 Z"
                fill="url(#centerStarGrad)"
              />
              <defs>
                <linearGradient id="centerStarGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </div>

        <motion.p
          className="mt-7 text-lg font-semibold"
          style={{
            background: "linear-gradient(90deg, #a78bfa, #22d3ee)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          ✨ AI 요약 생성 중…
        </motion.p>
        <p className="mt-2 text-xs text-zinc-500">잠시만 기다려주세요</p>
      </motion.div>
    </motion.div>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const selected = parseCategories(value);

  function toggle(c: Category) {
    const next = selected.includes(c)
      ? selected.filter((s) => s !== c)
      : [...selected, c];
    onChange(next.join(","));
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {CATEGORIES.map((c) => {
        const s = CATEGORY_STYLES[c];
        const active = selected.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
              active
                ? `${s.badge} border-current`
                : "border-white/10 bg-zinc-950 text-zinc-400 hover:border-white/30"
            }`}
          >
            <span className="mr-1.5 inline-block size-1.5 translate-y-[-1px] rounded-full align-middle bg-current" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

function NoticeRow({
  notice,
  active,
  onEdit,
  onDelete,
}: {
  notice: Notice;
  active: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cats = parseCategories(notice.category);
  const s = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const period = getEffectivePeriod(notice);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-zinc-900/50 p-4 transition ${
        active
          ? "border-zinc-400/60 shadow-[0_0_0_1px_rgba(244,244,245,0.15)]"
          : "border-white/5 hover:border-white/15"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${s.dot}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {cats.map((c) => {
              const cs = CATEGORY_STYLES[c];
              return (
                <span
                  key={c}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cs.badge}`}
                >
                  {cs.label}
                </span>
              );
            })}
            <span className="text-[11px] text-zinc-500">
              {formatAbsolute(notice.createdAt)}
              {" · "}
              {msToDate(period.start)}
              {" ~ "}
              <span className={period.isAutoEnd ? "text-amber-300/80" : undefined}>
                {msToDate(period.end)}
                {period.isAutoEnd ? ` (자동·${AUTO_PERIOD_DAYS}일)` : ""}
              </span>
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold text-zinc-100">
            {notice.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
            {notice.content}
          </p>
          {((notice as Notice & { checkCount?: number }).checkCount ?? 0) > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-400">
              <span>✓</span>
              {(notice as Notice & { checkCount?: number }).checkCount}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-row gap-1.5 lg:flex-col">
          <button
            onClick={onEdit}
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:border-white/30 hover:text-white lg:px-2.5 lg:py-1 lg:text-[11px]"
          >
            수정
          </button>
          <button
            onClick={onDelete}
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:border-red-500/60 hover:text-red-300 lg:px-2.5 lg:py-1 lg:text-[11px]"
          >
            삭제
          </button>
        </div>
      </div>
    </motion.li>
  );
}

function EmptyList() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <p className="text-sm text-zinc-300">아직 등록된 공지가 없습니다.</p>
    </div>
  );
}

/* ─── Reusable Form Component ─── */

function NoticeForm({
  form,
  setForm,
  editing,
  submitting,
  onSubmit,
  onReset,
  onBack,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editing: boolean;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onBack?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <Field label="카테고리">
        <CategoryPicker
          value={form.category}
          onChange={(c) => setForm((f) => ({ ...f, category: c }))}
        />
      </Field>

      <Field label="제목">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="예: 5/13 데이터구조 휴강 안내"
          className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
        />
      </Field>

      <Field label="내용">
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={6}
          placeholder="공지 내용을 입력하세요."
          className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed text-zinc-100 outline-none transition focus:border-zinc-500"
        />
      </Field>

      <Field label="링크 (선택)">
        <input
          type="url"
          value={form.link}
          onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
          placeholder="https://example.com"
          className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
        />
      </Field>

      <Field label="게시 기간">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
            className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition hover:border-white/30 focus:border-zinc-500 [&::-webkit-calendar-picker-indicator]:hidden"
          />
          <span className="text-xs text-zinc-500">~</span>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            onClick={(e) => (e.target as HTMLInputElement).showPicker()}
            className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition hover:border-white/30 focus:border-zinc-500 [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>
        {!form.endDate && (
          <p className="mt-1 text-[11px] text-amber-300/80">
            종료일을 비우면 시작일로부터 {AUTO_PERIOD_DAYS}일 뒤
            {form.startDate
              ? ` (${msToDate(dateToMs(form.startDate) + AUTO_PERIOD_DAYS * 24 * 60 * 60 * 1000)})`
              : ""}
            까지만 게시되고 자동으로 사라집니다.
          </p>
        )}
      </Field>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-60"
        >
          {submitting
            ? (editing && form.content.trim() === form.originalContent.trim())
              ? "저장 중…"
              : "✨ AI 요약 생성 중…"
            : editing
              ? "변경사항 저장"
              : "공지 등록"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onBack || onReset}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:border-white/30"
          >
            {onBack ? "취소" : "새 공지로 전환"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/* ─── Mobile List View ─── */

function MobileListView({
  notices,
  isLoading,
  error,
  onEdit,
  onDelete,
  onCreate,
}: {
  notices: Notice[];
  isLoading: boolean;
  error: { message: string } | null | undefined;
  onEdit: (n: Notice) => void;
  onDelete: (n: Notice) => void;
  onCreate: () => void;
}) {
  return (
    <div className="relative min-h-screen px-4 py-4">
      <SectionHeader
        title="등록된 공지"
        subtitle={`총 ${notices.length}건`}
      />
      {isLoading ? (
        <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-400">{error.message}</p>
      ) : notices.length === 0 ? (
        <EmptyList />
      ) : (
        <ul className="mt-4 space-y-3 pb-24">
          <AnimatePresence initial={false}>
            {notices.map((n) => (
              <NoticeRow
                key={n.id}
                notice={n}
                active={false}
                onEdit={() => onEdit(n)}
                onDelete={() => onDelete(n)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {/* FAB */}
      <button
        onClick={onCreate}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30 transition active:scale-95"
      >
        <span className="text-2xl font-bold">+</span>
      </button>
    </div>
  );
}

/* ─── Mobile Form View ─── */

function MobileFormView({
  form,
  setForm,
  editing,
  submitting,
  onSubmit,
  onReset,
  onBack,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  editing: boolean;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="min-h-screen bg-[#0f1219]"
    >
      <header className="sticky top-0 z-10 border-b border-white/5 bg-zinc-950/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-zinc-100">
            {editing ? "공지 수정" : "새 공지 작성"}
          </h1>
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-4 backdrop-blur">
          <NoticeForm
            form={form}
            setForm={setForm}
            editing={editing}
            submitting={submitting}
            onSubmit={onSubmit}
            onReset={onReset}
          />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * 기존 공지에 대해 AI 요약을 일괄 생성/재생성하는 버튼.
 * 대상: summary 가 비어있거나, 길이 정책(SUMMARY_HARD_CAP) 을 초과해 너무 긴 요약.
 * - 해당 공지가 한 건도 없으면 자체적으로 렌더하지 않는다.
 * - 순차 처리(Ollama Cloud rate limit 회피 + 진행률 표시 용이).
 */
function BackfillSummariesButton({ notices }: { notices: Notice[] }) {
  const pending = useMemo(
    () =>
      notices.filter((n) => {
        const s = (n as Notice & { summary?: string | null }).summary;
        const trimmed = s?.trim() ?? "";
        const hasSummary = trimmed.length > 0;
        const tooLong = trimmed.length > SUMMARY_HARD_CAP;
        // 본문이 MIN_CONTENT_LENGTH 미만이면 API 가 어차피 null 반환하므로 카운트에서 제외.
        const tooShort = n.content.trim().length < MIN_CONTENT_LENGTH;
        return (!hasSummary || tooLong) && !tooShort;
      }),
    [notices],
  );

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0 });

  if (!running && pending.length === 0) return null;

  async function handleClick() {
    setRunning(true);
    setProgress({ done: 0, failed: 0 });
    for (const n of pending) {
      const summary = await requestSummary(n.title, n.content);
      try {
        await db.transact(db.tx.notices[n.id].update({ summary }));
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch {
        setProgress((p) => ({ ...p, failed: p.failed + 1 }));
      }
    }
    setRunning(false);
  }

  const processed = progress.done + progress.failed;
  const label = running
    ? `백필 중 ${processed}/${pending.length}…`
    : `기존 공지 요약 백필/재생성 (${pending.length}건)`;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={running}
      className="rounded-full border border-cyan-700/40 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-300 transition hover:border-cyan-500/80 hover:text-cyan-200 disabled:opacity-60"
      title={
        running
          ? `처리 중: ${progress.done}건 성공, ${progress.failed}건 실패`
          : `summary 가 없거나 ${SUMMARY_HARD_CAP}자를 넘는 공지를 일괄 (재)생성`
      }
    >
      {label}
    </button>
  );
}
