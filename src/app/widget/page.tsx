"use client";

import { useState, useEffect, useCallback } from "react";

interface Notice {
  id: string;
  title: string;
  content?: string;
  createdAt: number;
}

const VERSION = "V.2026.5.1";
const DEPT_NAME = "게임소프트웨어학과";
const CYCLE_MS = 10000;

export default function WidgetPage() {
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [readRecords, setReadRecords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 공지 데이터 가져오기 (최대 12개 = 3페이지)
  const fetchNotices = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notices");
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      // 최대 12개(3페이지)만 표시
      const limitedNotices = (data.notices || []).slice(0, 12);
      setNotices(limitedNotices);
    } catch (err) {
      console.error("Failed to fetch:", err);
      setNotices([
        { id: "1", title: "시험 일정 안내", createdAt: Date.now() },
        { id: "2", title: "도서관 휴관 공지", createdAt: Date.now() - 86400000 },
        { id: "3", title: "학생회 홍보", createdAt: Date.now() - 172800000 },
        { id: "4", title: "장학금 신청 안내", createdAt: Date.now() - 259200000 },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleConfirm = useCallback((id: string) => {
    setReadRecords((prev) => ({ ...prev, [id]: true }));
    setSelectedId(null);
    // 확인 후 자동으로 뒤로 가지 않음 - 사용자가 수동으로 버튼 눌러야 함
  }, []);

  // 맨 뒤로 보내기
  const handleSendToBack = useCallback(() => {
    if (typeof window !== "undefined") {
      const epl = (window as any).epl;
      if (epl?.setAlwaysOnTop) {
        epl.setAlwaysOnTop(false);
      }
      // Electron IPC 호출 (배포 모드)
      if (epl?.sendToBack) {
        epl.sendToBack();
      }
    }
  }, []);

  const isUnread = useCallback(
    (noticeId: string) => !readRecords[noticeId],
    [readRecords]
  );

  const unreadCount = notices.filter((n) => isUnread(n.id)).length;

  const date = new Date(now);
  const formattedDate = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} (${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;
  const formattedTime = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  // 창 클릭 시 맨 앞으로
  const handleWindowClick = useCallback(() => {
    if (typeof window !== "undefined") {
      const epl = (window as any).epl;
      if (epl?.bringToFront) {
        epl.bringToFront();
      }
      if (epl?.setAlwaysOnTop) {
        epl.setAlwaysOnTop(true);
      }
    }
  }, []);

  return (
    <main
      className="h-[600px] w-[400px] bg-[#999999] flex flex-col overflow-hidden select-none font-sans relative"
      onClick={handleWindowClick}
    >
      {/* Header */}
      <header className="h-[50px] flex items-center justify-between px-3 py-1 shrink-0">
        <span className="text-[11px] text-[#CCCCCC] font-normal">{VERSION}</span>
        <div className="flex items-center text-[13px]">
          <span className="mr-1">📢</span>
          <span className="font-bold text-[#87CEEB]">{DEPT_NAME}</span>
          <span className="ml-1 text-[#E0E0E0] font-normal">공지 사항</span>
          {unreadCount > 0 && (
            <span className="ml-2 bg-[#FF4444] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendToBack}
            className="text-[#CCCCCC] hover:text-white text-sm px-2 py-1 transition-colors"
            title="맨 뒤로 보내기"
          >
            🔽
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[12px] text-[#E0E0E0]">{formattedDate}</span>
            <span className="text-[24px] font-bold text-[#FFFFFF] leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formattedTime}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col px-2 pb-2 min-h-0">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#CCCCCC]">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#87CEEB] border-t-transparent"></div>
              <span>로딩 중...</span>
            </div>
          </div>
        ) : (
          <NoticeList notices={notices} isUnread={isUnread} onSelect={setSelectedId} />
        )}
      </div>

      {/* Detail Overlay */}
      {selectedId && (
        <DetailOverlay
          notice={notices.find((n) => n.id === selectedId)!}
          onConfirm={() => handleConfirm(selectedId)}
        />
      )}
    </main>
  );
}

// 페이지당 4개, 최대 3페이지(12개) 고정
const ITEMS_PER_PAGE = 4;
const MAX_PAGES = 3;

function NoticeList({
  notices,
  isUnread,
  onSelect,
}: {
  notices: Notice[];
  isUnread: (id: string) => boolean;
  onSelect: (id: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(0);

  // 최대 3페이지로 제한 (12개 공지)
  const rawTotalPages = Math.ceil(notices.length / ITEMS_PER_PAGE);
  const totalPages = Math.min(rawTotalPages, MAX_PAGES);

  // 자동 순환: 10초마다 다음 페이지
  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, [totalPages]);

  // 현재 페이지에 표시할 공지 (최대 4개)
  const paginatedNotices = notices.slice(
    currentPage * ITEMS_PER_PAGE,
    Math.min((currentPage + 1) * ITEMS_PER_PAGE, MAX_PAGES * ITEMS_PER_PAGE)
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col gap-2 justify-start pt-2">
        {paginatedNotices.map((notice) => (
          <NoticeCard
            key={notice.id}
            notice={notice}
            isUnread={isUnread(notice.id)}
            onClick={() => onSelect(notice.id)}
          />
        ))}
      </div>

      {/* 페이지 인디케이터 - 최대 3개 도트 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 shrink-0">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentPage
                  ? "bg-[#87CEEB] w-[20px] h-[6px]"
                  : "bg-[#777777] w-[6px] h-[6px]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeCard({
  notice,
  isUnread,
  onClick,
}: {
  notice: Notice;
  isUnread: boolean;
  onClick: () => void;
}) {
  const dateStr = notice.createdAt
    ? new Date(notice.createdAt).toLocaleDateString("ko-KR")
    : "";

  return (
    <button
      onClick={onClick}
      className="h-[100px] bg-[#555555] rounded-[6px] px-4 py-3 text-left transition-all duration-150 hover:bg-[#666666] flex items-center justify-between shrink-0"
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-[18px] font-bold text-[#FFFFFF] leading-snug truncate">
          {notice.title}
        </h3>
        <p className="text-[12px] text-[#CCCCCC] mt-1">{dateStr}</p>
      </div>

      {isUnread && (
        <div className="ml-3 flex-shrink-0">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4444] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF4444]"></span>
          </span>
        </div>
      )}
    </button>
  );
}

function DetailOverlay({
  notice,
  onConfirm,
}: {
  notice: Notice;
  onConfirm: () => void;
}) {
  const dateStr = notice.createdAt
    ? new Date(notice.createdAt).toLocaleDateString("ko-KR")
    : "";

  return (
    <div
      className="absolute inset-0 bg-black/65 flex items-center justify-center z-10 p-4"
      onClick={onConfirm}
    >
      <div
        className="w-[360px] max-h-[480px] bg-[#555555] rounded-[8px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#666666]">
          <span className="text-[11px] text-[#CCCCCC]">{VERSION}</span>
          <button
            onClick={onConfirm}
            className="w-8 h-8 flex items-center justify-center text-[#CCCCCC] hover:text-white text-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-lg font-bold text-white mb-2">{notice.title}</h2>
          <p className="text-xs text-[#CCCCCC] mb-4">{dateStr}</p>
          <p className="text-sm text-white leading-relaxed whitespace-pre-line">
            {notice.content || "내용이 없습니다."}
          </p>
        </div>

        <div className="p-3 border-t border-[#666666]">
          <button
            onClick={onConfirm}
            className="w-full py-3 bg-[#777777] hover:bg-[#888888] rounded-[6px] text-sm font-bold text-white"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
}
