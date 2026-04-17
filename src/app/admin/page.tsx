"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { id } from "@instantdb/react";
import {
  asCategory,
  CATEGORIES,
  db,
  type Category,
  type Notice,
} from "@/lib/instant";
import { CATEGORY_STYLES, formatAbsolute } from "@/lib/categories";

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
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  return <Dashboard onSignOut={() => setAuthed(false)} />;
}

/* -------------------------------------------------------------------------- */
/*  Password Gate                                                              */
/* -------------------------------------------------------------------------- */

function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!expected) {
      setError("관리자 비밀번호가 설정되지 않았습니다. (.env.local 확인)");
      return;
    }
    if (value === expected) {
      sessionStorage.setItem("admin_authed", "1");
      onSuccess();
    } else {
      setError("비밀번호가 올바르지 않습니다.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-white/5 bg-zinc-900/70 p-8 shadow-2xl backdrop-blur"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50">
          관리자 로그인
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          공지사항 관리를 위해 비밀번호를 입력하세요.
        </p>
        <label className="mt-6 block text-xs font-medium text-zinc-400">
          비밀번호
        </label>
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          autoFocus
          className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
          placeholder="••••••••"
        />
        {error ? (
          <p className="mt-3 text-xs text-red-400">{error}</p>
        ) : null}
        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
        >
          입장
        </button>
      </motion.form>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

interface FormState {
  id: string | null; // null 이면 새 공지
  title: string;
  content: string;
  professor: string;
  category: Category;
}

const EMPTY_FORM: FormState = {
  id: null,
  title: "",
  content: "",
  professor: "",
  category: "일반",
};

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const editing = form.id !== null;
  const notices: Notice[] = useMemo(() => data?.notices ?? [], [data]);

  function startEdit(n: Notice) {
    setForm({
      id: n.id,
      title: n.title,
      content: n.content,
      professor: n.professor,
      category: asCategory(n.category),
    });
  }

  function reset() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.professor.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      if (editing && form.id) {
        await db.transact(
          db.tx.notices[form.id].update({
            title: form.title.trim(),
            content: form.content.trim(),
            professor: form.professor.trim(),
            category: form.category,
          }),
        );
      } else {
        await db.transact(
          db.tx.notices[id()].update({
            title: form.title.trim(),
            content: form.content.trim(),
            professor: form.professor.trim(),
            category: form.category,
            createdAt: Date.now(),
          }),
        );
      }
      reset();
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

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Admin Dashboard
            </p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-50">
              공지사항 관리
            </h1>
          </div>
          <div className="flex items-center gap-2">
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

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_400px]">
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
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6 backdrop-blur">
            <SectionHeader
              title={editing ? "공지 수정" : "새 공지 작성"}
              subtitle={editing ? "선택된 공지를 수정합니다" : undefined}
              right={
                editing ? (
                  <button
                    onClick={reset}
                    type="button"
                    className="text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    + 새 공지로 전환
                  </button>
                ) : null
              }
            />
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="예: 5/13 데이터구조 휴강 안내"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                />
              </Field>

              <Field label="작성자 (교수명)">
                <input
                  type="text"
                  value={form.professor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, professor: e.target.value }))
                  }
                  placeholder="예: 김교수"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-zinc-500"
                />
              </Field>

              <Field label="내용">
                <textarea
                  value={form.content}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, content: e.target.value }))
                  }
                  rows={6}
                  placeholder="공지 내용을 입력하세요."
                  className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm leading-relaxed text-zinc-100 outline-none transition focus:border-zinc-500"
                />
              </Field>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:opacity-60"
                >
                  {submitting
                    ? "저장 중…"
                    : editing
                      ? "변경사항 저장"
                      : "공지 등록"}
                </button>
                {editing ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:border-white/30"
                  >
                    취소
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                              */
/* -------------------------------------------------------------------------- */

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
  value: Category;
  onChange: (c: Category) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CATEGORIES.map((c) => {
        const s = CATEGORY_STYLES[c];
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
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
  const cat = asCategory(notice.category);
  const s = CATEGORY_STYLES[cat];

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
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.badge}`}
            >
              {s.label}
            </span>
            <span className="text-[11px] text-zinc-500">
              {formatAbsolute(notice.createdAt)}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-sm font-semibold text-zinc-100">
            {notice.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
            {notice.content}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            작성: <span className="text-zinc-300">{notice.professor}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={onEdit}
            className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-white/30 hover:text-white"
          >
            수정
          </button>
          <button
            onClick={onDelete}
            className="rounded-md border border-white/10 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-red-500/60 hover:text-red-300"
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
      <p className="mt-1 text-xs text-zinc-500">
        오른쪽 폼에서 첫 공지를 작성해 보세요.
      </p>
    </div>
  );
}
