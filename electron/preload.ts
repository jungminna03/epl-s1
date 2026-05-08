import { contextBridge, ipcRenderer } from "electron";

/**
 * Renderer ↔ Main IPC 표면.
 *
 * 이 표면은 **인스톨러에 박히면 다시 못 늘림**. 그래서 지금 한 번에 넓게 깔아둔다.
 * 새 기능 추가 시 우선 main.ts 핸들러만 추가하고, 여기서 노출한 메서드를 통해
 * 호출하도록 한다.
 */
contextBridge.exposeInMainWorld("epl", {
  // ─── 라이프사이클 / 표시 ───────────────────────────────────────
  quit: () => ipcRenderer.send("widget:quit"),
  restart: () => ipcRenderer.send("widget:restart"),
  hide: () => ipcRenderer.send("widget:hide"),
  show: () => ipcRenderer.send("widget:show"),
  minimize: () => ipcRenderer.send("widget:minimize"),
  reload: () => ipcRenderer.send("widget:reload"),
  navigate: (url: string) => ipcRenderer.send("widget:navigate", url),

  // ─── 외부 ───────────────────────────────────────────────────
  openExternal: (url: string) => ipcRenderer.send("widget:open-external", url),

  // ─── 창 조작 ────────────────────────────────────────────────
  setBounds: (b: Partial<Bounds>) => ipcRenderer.send("widget:set-bounds", b),
  setAlwaysOnTop: (value: boolean) =>
    ipcRenderer.send("widget:set-always-on-top", value),
  setOpacity: (value: number) => ipcRenderer.send("widget:set-opacity", value),
  setIgnoreMouseEvents: (value: boolean, opts?: { forward?: boolean }) =>
    ipcRenderer.send("widget:set-ignore-mouse", { value, forward: opts?.forward }),
  setZoomFactor: (factor: number) => ipcRenderer.send("widget:set-zoom", factor),

  // ─── 멀티 모니터 ────────────────────────────────────────────
  getDisplays: (): Promise<DisplayInfo[]> =>
    ipcRenderer.invoke("widget:get-displays"),
  moveToDisplay: (displayId: number) =>
    ipcRenderer.send("widget:move-to-display", displayId),

  // ─── 디버그 / 관측 ──────────────────────────────────────────
  openDevTools: () => ipcRenderer.send("widget:open-devtools"),
  log: (level: "info" | "warn" | "error" | "debug", message: string) =>
    ipcRenderer.send("widget:log", { level, message }),
  getNativeInfo: (): Promise<NativeInfo> =>
    ipcRenderer.invoke("widget:get-native-info"),

  // ─── 업데이트 ──────────────────────────────────────────────
  forceUpdateCheck: () => ipcRenderer.send("widget:force-update-check"),
  applyUpdateAndRestart: () =>
    ipcRenderer.send("widget:apply-update-and-restart"),
  onUpdateStatus: (handler: (status: UpdateStatus) => void) => {
    const listener = (_e: unknown, status: UpdateStatus) => handler(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.off("updater:status", listener);
  },

  // ─── Config ────────────────────────────────────────────────
  /** 현재 적용 중인 부트스트랩 config 를 가져옴 (윈도우 크기 등 표시용) */
  getConfig: (): Promise<unknown> => ipcRenderer.invoke("widget:get-config"),
  /** main 이 원격 config 를 다시 로드해 변경분이 적용됐을 때 알림 */
  onConfigReloaded: (handler: (config: unknown) => void) => {
    const listener = (_e: unknown, c: unknown) => handler(c);
    ipcRenderer.on("widget:config-reloaded", listener);
    return () => ipcRenderer.off("widget:config-reloaded", listener);
  },
});

export type Bounds = { x: number; y: number; width: number; height: number };

export type DisplayInfo = {
  id: number;
  bounds: Bounds;
  workArea: Bounds;
  scaleFactor: number;
  primary: boolean;
};

export type NativeInfo = {
  appVersion: string;
  electronVersion: string;
  nodeVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  displayCount: number;
};

export type UpdateStatus =
  | { kind: "checking" }
  | { kind: "available"; version: string }
  | { kind: "not-available" }
  | { kind: "downloading"; percent: number }
  | { kind: "downloaded"; version: string }
  | { kind: "error"; message: string };

declare global {
  interface Window {
    epl: {
      // 라이프사이클
      quit: () => void;
      restart: () => void;
      hide: () => void;
      show: () => void;
      minimize: () => void;
      reload: () => void;
      navigate: (url: string) => void;
      // 외부
      openExternal: (url: string) => void;
      // 창 조작
      setBounds: (b: Partial<Bounds>) => void;
      setAlwaysOnTop: (value: boolean) => void;
      setOpacity: (value: number) => void;
      setIgnoreMouseEvents: (value: boolean, opts?: { forward?: boolean }) => void;
      setZoomFactor: (factor: number) => void;
      // 멀티 모니터
      getDisplays: () => Promise<DisplayInfo[]>;
      moveToDisplay: (displayId: number) => void;
      // 디버그
      openDevTools: () => void;
      log: (level: "info" | "warn" | "error" | "debug", message: string) => void;
      getNativeInfo: () => Promise<NativeInfo>;
      // 업데이트
      forceUpdateCheck: () => void;
      applyUpdateAndRestart: () => void;
      onUpdateStatus: (handler: (status: UpdateStatus) => void) => () => void;
      // config
      getConfig: () => Promise<unknown>;
      onConfigReloaded: (handler: (config: unknown) => void) => () => void;
    };
  }
}
