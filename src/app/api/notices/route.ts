import { NextResponse } from "next/server";

/**
 * GET /api/notices
 * 위젯에서 호출하는 공지사항 API
 * InstantDB 데이터를 REST API로 노출
 */

// 예시 데이터 (DB 연동 전까지 사용)
const mockNotices = [
  {
    id: "1",
    title: "시험 일정 안내",
    content: "중간고사가 5월 20일부터 시작됩니다. 자세한 시간표는 학과 게시판을 확인하세요.",
    date: "2026-05-11",
    createdAt: Date.now(),
    type: "학사",
    duration: null,
    unlimited: false,
  },
  {
    id: "2",
    title: "도서관 휴관 공지",
    content: "5월 15일 도서관 정기점검으로 인해 휴관합니다.",
    date: "2026-05-10",
    createdAt: Date.now() - 86400000,
    type: "시설",
    duration: null,
    unlimited: false,
  },
  {
    id: "3",
    title: "학생회 홍보",
    content: "2026학년도 학생회 임원 모집이 시작되었습니다.",
    date: "2026-05-09",
    createdAt: Date.now() - 172800000,
    type: "학생회",
    duration: null,
    unlimited: false,
  },
  {
    id: "4",
    title: "장학금 신청 안내",
    content: "성적 우수 장학금 신청 기간입니다. 학사 시스템에서 신청하세요.",
    date: "2026-05-08",
    createdAt: Date.now() - 259200000,
    type: "장학",
    duration: null,
    unlimited: false,
  },
  {
    id: "5",
    title: "봉사활동 모집",
    content: "지역 사랑방 봉사활동 참여자를 모집합니다.",
    date: "2026-05-07",
    createdAt: Date.now() - 345600000,
    type: "봉사",
    duration: null,
    unlimited: false,
  },
  {
    id: "6",
    title: "취업 특강 안내",
    content: "게임업계 취업 성공 특강이 5월 25일에 열립니다.",
    date: "2026-05-06",
    createdAt: Date.now() - 432000000,
    type: "취업",
    duration: null,
    unlimited: false,
  },
];

export async function GET(request: Request) {
  try {
    // TODO: InstantDB 연동
    // 실제 DB에서 가져오는 로직으로 교체 예정
    // const notices = await db.query({ notices: { $: { order: { createdAt: "desc" } } } });

    // 만료된 공지 필터링
    const now = Date.now();
    const activeNotices = mockNotices.filter((notice) => {
      if (notice.unlimited) return true;
      const expirationDays = notice.duration || 7; // 기본 7일
      return now - notice.createdAt < expirationDays * 24 * 60 * 60 * 1000;
    });

    // 최신순 정렬
    activeNotices.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      notices: activeNotices,
      total: activeNotices.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to fetch notices:", error);
    return NextResponse.json(
      { error: "Failed to fetch notices" },
      { status: 500 }
    );
  }
}

// CORS 헤더 설정
export async function OPTIONS(request: Request) {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
