import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";
import { APP_CONFIG } from "./config";

export function createWidgetWindow(): BrowserWindow {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const { width, height, marginRight, marginBottom } = APP_CONFIG.widget;

  const win = new BrowserWindow({
    width,
    height,
    x: sw - width - marginRight,
    y: sh - height - marginBottom,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    minimizable: true,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // "바탕화면에 박힌 위젯" — 다른 창에 가리지 않으면서, 풀스크린 게임이나
  // 브라우저 풀스크린은 가리지 않도록 normal 레벨로 위에 띄움.
  win.setAlwaysOnTop(true, "normal");
  win.setVisibleOnAllWorkspaces(true);

  win.once("ready-to-show", () => win.show());

  // 외부 링크는 시스템 기본 브라우저로.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  void win.loadURL(APP_CONFIG.widgetUrl);

  return win;
}
