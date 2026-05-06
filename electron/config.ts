import { app } from "electron";

const isDev = !app.isPackaged;

export const APP_CONFIG = {
  isDev,
  /** 위젯이 로드할 URL. dev에선 로컬 Next.js, prod에선 Vercel 배포본. */
  widgetUrl: isDev
    ? "http://localhost:3000/widget"
    : "https://epl-s1.vercel.app/widget",
  /** 자동 업데이트 매니페스트 호스트 (electron-updater generic provider).
   *  Vercel Blob Storage — 인스톨러가 100MB를 넘어 정적 호스팅 불가, Blob 사용. */
  updateFeedUrl: "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com",
  /** 자동 업데이트 폴링 주기 (ms). */
  updateIntervalMs: 30 * 60 * 1000,
  /** 위젯 초기 크기. */
  widget: {
    width: 360,
    height: 520,
    /** 화면 우하단으로부터의 여백(px). */
    marginRight: 24,
    marginBottom: 24,
  },
} as const;
