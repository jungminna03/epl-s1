import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("epl", {
  quit: () => ipcRenderer.send("widget:quit"),
  minimize: () => ipcRenderer.send("widget:minimize"),
  openExternal: (url: string) => ipcRenderer.send("widget:open-external", url),
  /** 메인이 푸시하는 업데이트 상태 구독. */
  onUpdateStatus: (handler: (status: UpdateStatus) => void) => {
    const listener = (_e: unknown, status: UpdateStatus) => handler(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.off("updater:status", listener);
  },
});

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
      quit: () => void;
      minimize: () => void;
      openExternal: (url: string) => void;
      onUpdateStatus: (handler: (status: UpdateStatus) => void) => () => void;
    };
  }
}
