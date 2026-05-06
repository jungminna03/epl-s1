"use client";

import { useEffect, useState } from "react";
import { db, type Notice } from "@/lib/instant";
import {
  CATEGORY_STYLES,
  DEFAULT_STYLE,
  formatRelative,
  isNoticeVisible,
  parseCategories,
} from "@/lib/categories";

const VISIBLE_COUNT = 3;
const DISPLAY_URL = "https://epl-s1.vercel.app/display";

function getCheckCount(notice: Notice): number {
  return (notice as Notice & { checkCount?: number }).checkCount ?? 0;
}

function openExternal(url: string) {
  const epl = (window as Window & { epl?: { openExternal: (u: string) => void } })
    .epl;
  if (epl?.openExternal) epl.openExternal(url);
  else window.open(url, "_blank");
}

export default function WidgetPage() {
  // 루트 layout의 body 배경을 투명으로 덮어쓴다 (Electron transparent 창용).
  useEffect(() => {
    document.body.classList.add("widget-mode");
    return () => document.body.classList.remove("widget-mode");
  }, []);

  const { isLoading, error, data } = db.useQuery({
    notices: { $: { order: { createdAt: "desc" } } },
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const visible = (data?.notices ?? [])
    .filter((n) => isNoticeVisible(n, now))
    .slice(0, VISIBLE_COUNT);

  return (
    <div
      className="flex flex-col overflow-hidden text-slate-100"
      style={{
        width: "100vw",
        height: "100vh",
        borderRadius: 18,
        background:
          "linear-gradient(160deg, rgba(15,18,25,0.92) 0%, rgba(20,24,38,0.92) 100%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(148,163,184,0.12)",
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <Header now={now} />

      <div className="flex-1 overflow-hidden" style={{ padding: "0 14px 12px" }}>
        {isLoading ? (
          <Skeleton />
        ) : error ? (
          <ErrorState message={error.message} />
        ) : visible.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col" style={{ gap: 8 }}>
            {visible.map((n) => (
              <NoticeRow key={n.id} notice={n} now={now} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

function Header({ now }: { now: number }) {
  const d = new Date(now);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

  return (
    <header
      className="flex shrink-0 items-center justify-between"
      style={{
        padding: "12px 14px 8px",
        borderBottom: "1px solid rgba(148,163,184,0.08)",
        // 헤더 전체를 드래그 영역으로 — 사용자가 위젯을 드래그해 옮길 수 있다.
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          className="rounded-full bg-cyan-400"
          style={{
            width: 6,
            height: 6,
            boxShadow: "0 0 6px rgba(34,211,238,0.7)",
            animation: "livePulse 2s ease-in-out infinite",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          <span
            style={{
              background: "linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            게임소프트웨어학과
          </span>
          <span style={{ marginLeft: 4, color: "#94a3b8", fontWeight: 400 }}>
            공지
          </span>
        </span>
      </div>
      <div
        className="flex items-center"
        style={{ gap: 8, WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <span
          style={{
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            color: "#cbd5e1",
            fontWeight: 600,
          }}
        >
          {time}
        </span>
        <HeaderButton
          title="숨기기"
          onClick={() =>
            (
              window as Window & { epl?: { minimize: () => void } }
            ).epl?.minimize()
          }
        >
          –
        </HeaderButton>
        <HeaderButton
          title="종료"
          onClick={() =>
            (window as Window & { epl?: { quit: () => void } }).epl?.quit()
          }
        >
          ×
        </HeaderButton>
      </div>
    </header>
  );
}

function HeaderButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/8 hover:text-slate-100"
      style={{
        width: 22,
        height: 22,
        fontSize: 16,
        lineHeight: 1,
        WebkitAppRegion: "no-drag",
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

function NoticeRow({ notice, now }: { notice: Notice; now: number }) {
  const cats = parseCategories(notice.category);
  const style = cats.length > 0 ? CATEGORY_STYLES[cats[0]] : DEFAULT_STYLE;
  const count = getCheckCount(notice);

  const handleClick = () => {
    if (notice.link) openExternal(notice.link);
    else openExternal(DISPLAY_URL);
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex w-full items-center overflow-hidden rounded-[10px] text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: "rgba(26,34,51,0.85)",
        border: "1px solid rgba(148,163,184,0.08)",
        padding: "10px 12px 10px 14px",
        gap: 10,
      }}
    >
      {/* 좌측 액센트 바 */}
      <span
        className="absolute"
        style={{
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: style.color,
        }}
      />

      {cats.length > 0 && (
        <span
          className={`shrink-0 rounded-full border font-bold ${style.badge}`}
          style={{
            fontSize: 9.5,
            padding: "2px 6px",
            lineHeight: 1.2,
          }}
        >
          {style.label}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p
          className="truncate font-bold text-slate-50"
          style={{ fontSize: 13, lineHeight: 1.25 }}
        >
          {notice.title}
        </p>
        <p
          className="truncate text-slate-500"
          style={{ fontSize: 10.5, marginTop: 2 }}
        >
          {formatRelative(notice.createdAt, now)}
          {count > 0 ? ` · 확인 ${count}` : ""}
        </p>
      </div>
    </button>
  );
}

function Footer() {
  return (
    <footer
      className="flex shrink-0 items-center justify-between"
      style={{
        padding: "8px 14px 12px",
        borderTop: "1px solid rgba(148,163,184,0.08)",
      }}
    >
      <span style={{ fontSize: 10, color: "#64748b" }}>실시간 동기화 중</span>
      <button
        onClick={() => openExternal(DISPLAY_URL)}
        className="text-slate-300 transition-colors hover:text-cyan-300"
        style={{ fontSize: 11, fontWeight: 600 }}
      >
        전체 보기 →
      </button>
    </footer>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col" style={{ gap: 8, paddingTop: 12 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-[10px]"
          style={{
            height: 50,
            background: "rgba(26,34,51,0.6)",
            border: "1px solid rgba(148,163,184,0.06)",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex h-full items-center justify-center text-center text-slate-500"
      style={{ fontSize: 12, padding: 24 }}
    >
      현재 공지가 없습니다.
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center text-center"
      style={{ padding: 16, gap: 4 }}
    >
      <p style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>
        불러오기 실패
      </p>
      <p style={{ fontSize: 10, color: "#94a3b8" }}>{message}</p>
    </div>
  );
}
