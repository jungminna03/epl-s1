import { BrowserWindow, app } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import type { WidgetConfig } from "./bootstrap";
import type { UpdateStatus } from "./preload";

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function setupAutoUpdater(
  getWindow: () => BrowserWindow | null,
  config: WidgetConfig,
  isDev: boolean,
) {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // generic provider — Vercel Blob 에서 latest.yml + .exe + blockmap 을 서빙.
  autoUpdater.setFeedURL({
    provider: "generic",
    url: config.updateFeedUrl,
  });

  const push = (status: UpdateStatus) => {
    const win = getWindow();
    win?.webContents.send("updater:status", status);
  };

  autoUpdater.removeAllListeners();
  autoUpdater.on("checking-for-update", () => push({ kind: "checking" }));
  autoUpdater.on("update-available", (info) =>
    push({ kind: "available", version: info.version }),
  );
  autoUpdater.on("update-not-available", () => push({ kind: "not-available" }));
  autoUpdater.on("download-progress", (p) =>
    push({ kind: "downloading", percent: p.percent }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    push({ kind: "downloaded", version: info.version });
    // 다운로드 완료 후 앱 종료/재시작 시점에 설치되도록 둠.
  });
  autoUpdater.on("error", (err) =>
    push({ kind: "error", message: err.message }),
  );

  if (isDev) {
    log.info("[updater] dev 모드 — 자동 업데이트 비활성화");
    return;
  }

  void autoUpdater.checkForUpdates().catch((err) => log.error(err));
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void autoUpdater.checkForUpdates().catch((err) => log.error(err));
  }, config.pollIntervalMs);

  app.on("before-quit", () => {
    log.info("[updater] before-quit — quitAndInstall 시도");
  });
}

/** 외부(IPC)에서 강제 업데이트 체크 트리거 */
export function forceUpdateCheck(): Promise<unknown> {
  return autoUpdater.checkForUpdates();
}

/** 즉시 재시작하며 다운로드된 업데이트 설치 */
export function applyUpdateAndRestart(): void {
  autoUpdater.quitAndInstall();
}
