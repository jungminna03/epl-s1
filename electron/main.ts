import { BrowserWindow, app, ipcMain, shell, Tray } from "electron";
import log from "electron-log";
import { APP_CONFIG } from "./config";
import { createTray } from "./tray";
import { setupAutoUpdater } from "./updater";
import { createWidgetWindow } from "./widget-window";

log.initialize();
log.info(`[main] EPL widget 시작 (dev=${APP_CONFIG.isDev})`);

// 단일 인스턴스 — 두 번째 실행은 즉시 종료하고 기존 창을 보여준다.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let widgetWin: BrowserWindow | null = null;
let tray: Tray | null = null;

app.on("second-instance", () => {
  if (!widgetWin) return;
  if (widgetWin.isMinimized()) widgetWin.restore();
  widgetWin.show();
  widgetWin.focus();
});

function registerAutoLaunch() {
  // 부팅 시 자동 시작. dev에선 끔.
  if (APP_CONFIG.isDev) return;
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    args: [],
  });
}

function registerIpc(getWindow: () => BrowserWindow | null) {
  ipcMain.on("widget:quit", () => app.quit());
  ipcMain.on("widget:minimize", () => getWindow()?.hide());
  ipcMain.on("widget:open-external", (_e, url: string) => {
    if (typeof url !== "string") return;
    if (!/^https?:\/\//.test(url)) return;
    void shell.openExternal(url);
  });
}

void app.whenReady().then(() => {
  registerAutoLaunch();
  registerIpc(() => widgetWin);

  widgetWin = createWidgetWindow();
  widgetWin.on("closed", () => {
    widgetWin = null;
  });

  tray = createTray(() => widgetWin);

  setupAutoUpdater(() => widgetWin);
});

// 위젯이라 macOS dock 동작은 비범위; Windows 전용.
app.on("window-all-closed", () => {
  // 트레이 유지 — 종료는 트레이 메뉴에서.
});

app.on("before-quit", () => {
  tray?.destroy();
});
