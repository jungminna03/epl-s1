import { BrowserWindow, app } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import type { WidgetConfig } from "./bootstrap";
import type { UpdateStatus } from "./preload";

let pollTimer: ReturnType<typeof setInterval> | null = null;
let updateDownloaded = false;

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
    updateDownloaded = true;
    push({ kind: "downloaded", version: info.version });
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

/** 다운로드 완료 상태이면 즉시 재시작하며 설치. 아니면 no-op —
 *  렌더러의 주기적 트리거에서 안전하게 호출할 수 있도록. */
export function applyUpdateAndRestart(): void {
  if (!updateDownloaded) return;
  autoUpdater.quitAndInstall();
}
