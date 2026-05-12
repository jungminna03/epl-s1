import { app } from "electron";

const isDev = !app.isPackaged;

/** SYSTEM_STATEMENT.md 기반 모드 설정 */
export const APP_CONFIG = {
  isDev,

  /** 앱이 로드할 URL — 위젯 페이지 */
  widgetUrl: isDev
    ? "http://localhost:3000/widget"
    : "https://epl-s1.vercel.app/widget",

  /** 자동 업데이트 매니페스트 호스트 (electron-updater generic provider).
   *  Vercel Blob Storage — 인스톨러가 100MB를 넘어 정적 호스팅 불가, Blob 사용. */
  updateFeedUrl: "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com",

  /** 자동 업데이트 폴링 주기 (ms). */
  updateIntervalMs: 30 * 60 * 1000,

  /** 위젯 고정 크기 — SYSTEM_STATEMENT.md 스펙: 400×600px */
  widget: {
    width: 400,
    height: 600,
  },

  /** 창 위치 — 우하단 기준 (픽셀) */
  position: {
    anchor: "bottom-right" as const,
    marginX: isDev ? 100 : 24,  // 개발: 드래그 테스트용 여유 공간
    marginY: isDev ? 100 : 24,
  },

  /** 배포 모드 창 동작 — 항상 위가 아닌 뒤로 가려지도록 */
  windowBehavior: {
    /** 개발 모드: 닫기 버튼 표시, Alt+F4 가능, 창 이동 가능, 좌표 표시 */
    /** 배포 모드: 닫기 버튼 숨김, Alt+F4 차단, 창 고정, 좌표 숨김 */
    showCloseButton: isDev,
    allowClose: isDev,
    movable: isDev,
    resizable: isDev,  // 개발 시에만 크기 조절 가능
    showCoordinates: isDev,

    /** 배포 시 창이 다른 창에 가려지도록 (false: 맨 뒤로, true: 맨 앞으로) */
    alwaysOnTop: false,

    /** 배포 시 창이 키워도/클릭해도 앞으로 나오지 않음 */
    stayInBackground: !isDev,

    /** 작업 표시줄 표시 여부 */
    showInTaskbar: isDev,
  },

  /** 부트스트랩 URL */
  bootstrapUrl:
    "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json",
} as const;
