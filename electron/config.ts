import { app } from "electron";

const isDev = !app.isPackaged;

export const APP_CONFIG = {
  isDev,
  /** 앱이 로드할 URL — 사이니지 디스플레이 페이지를 그대로 랩핑. */
  widgetUrl: isDev
    ? "http://localhost:3000/display"
    : "https://epl-s1.vercel.app/display",
  /** 자동 업데이트 매니페스트 호스트 (electron-updater generic provider).
   *  Vercel Blob Storage — 인스톨러가 100MB를 넘어 정적 호스팅 불가, Blob 사용. */
  updateFeedUrl: "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com",
  /** 자동 업데이트 폴링 주기 (ms). */
  updateIntervalMs: 30 * 60 * 1000,
  /** 위젯 초기 크기 — SYSTEM_STATEMENT.md 스펙. */
  widget: {
    width: 400,
    height: 600,
    /** 화면 우하단으로부터의 여백(px). */
    marginRight: 24,
    marginBottom: 24,
  },
  /** 부트스트랩 URL — TODO: 다음 빌드부터는 이 URL 만 박히고 나머지는 원격 JSON 으로 빠짐 */
  bootstrapUrl:
    "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com/widget-config.json",
} as const;
