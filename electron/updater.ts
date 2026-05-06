import { BrowserWindow, app } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import { APP_CONFIG } from "./config";
import type { UpdateStatus } from "./preload";

export function setupAutoUpdater(getWindow: () => BrowserWindow | null) {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // generic provider — Vercel 정적 호스팅에서 latest.yml + nupkg/exe 파일을 서빙.
  autoUpdater.setFeedURL({
    provider: "generic",
    url: APP_CONFIG.updateFeedUrl,
  });

  const push = (status: UpdateStatus) => {
    const win = getWindow();
    win?.webContents.send("updater:status", status);
  };

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
    // 즉시 재시작이 필요하면 autoUpdater.quitAndInstall() 호출.
  });
  autoUpdater.on("error", (err) =>
    push({ kind: "error", message: err.message }),
  );

  if (APP_CONFIG.isDev) {
    log.info("[updater] dev 모드 — 자동 업데이트 비활성화");
    return;
  }

  // 부팅 직후 한 번 + 주기 폴링.
  void autoUpdater.checkForUpdates().catch((err) => log.error(err));
  setInterval(() => {
    void autoUpdater.checkForUpdates().catch((err) => log.error(err));
  }, APP_CONFIG.updateIntervalMs);

  app.on("before-quit", () => {
    log.info("[updater] before-quit — quitAndInstall 시도");
  });
}
