import {
  BrowserWindow,
  Tray,
  app,
  ipcMain,
  screen,
  session,
  shell,
} from "electron";
import log from "electron-log";
import { APP_CONFIG } from "./config";
import {
  isAllowedHost,
  loadBootstrapConfig,
  type WidgetConfig,
} from "./bootstrap";
import { createTray } from "./tray";
import {
  applyUpdateAndRestart,
  forceUpdateCheck,
  setupAutoUpdater,
} from "./updater";
import { createWidgetWindow } from "./widget-window";

import path from "node:path";
import os from "node:os";
import { exec } from "node:child_process";

log.initialize();
log.info(`[main] EPL widget 시작 (dev=${APP_CONFIG.isDev})`);

// 캐시 문제 해결: userData 경로를 임시 폴더로 변경
const userDataPath = path.join(os.tmpdir(), `epl-widget-${Date.now()}`);
app.setPath("userData", userDataPath);
log.info(`[main] userData path: ${userDataPath}`);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// 앱 시작 시 세션 캐시 클리어
app.on("ready", async () => {
  try {
    const defaultSession = session.defaultSession;
    if (defaultSession) {
      await defaultSession.clearCache();
      log.info("[main] Session cache cleared");
    }
  } catch (err) {
    log.warn(`[main] Failed to clear cache: ${err}`);
  }
});

let widgetWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let activeConfig: WidgetConfig | null = null;

app.on("second-instance", () => {
  if (!widgetWin) return;
  if (widgetWin.isMinimized()) widgetWin.restore();
  widgetWin.show();
  widgetWin.focus();
});

function registerAutoLaunch() {
  if (APP_CONFIG.isDev) return;
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: [],
  });
}

void app.whenReady().then(async () => {
  registerAutoLaunch();

  const config = await loadBootstrapConfig(APP_CONFIG.bootstrapUrl, APP_CONFIG.isDev);
  activeConfig = config;
  log.info(
    `[main] config: widgetUrl=${config.widgetUrl}, kill=${config.kill}, alwaysOnTop=${config.window.alwaysOnTop}`,
  );

  registerIpc(
    () => widgetWin,
    () => activeConfig,
  );

  if (config.kill) {
    showKillScreen(config.killMessage);
    return;
  }

  widgetWin = createWidgetWindow(config);
  navigateWithFallback(widgetWin, config.widgetUrl);

  widgetWin.on("closed", () => {
    widgetWin = null;
  });

  tray = createTray(() => widgetWin);

  setupAutoUpdater(() => widgetWin, config, APP_CONFIG.isDev);
});

app.on("window-all-closed", () => {
  // 트레이 유지 — 종료는 트레이 메뉴에서.
});

app.on("before-quit", () => {
  tray?.destroy();
});

/* ─── Network Failure 대응: 재시도 + 에러 페이지 ─── */

function navigateWithFallback(win: BrowserWindow, url: string) {
  let retryDelay = 5000;
  let isShowingError = false;
  let pendingRetry: ReturnType<typeof setTimeout> | null = null;

  const tryLoad = () => {
    isShowingError = false;
    void win.loadURL(url).catch((err) => {
      log.warn(`[widget] loadURL 실패: ${(err as Error).message}`);
    });
  };

  win.webContents.on("did-fail-load", (_e, code, desc, validatedUrl) => {
    if (isShowingError) return;
    if (code === -3) return; // ABORTED — 새 navigation 으로 인한 정상 케이스
    log.warn(
      `[widget] did-fail-load: code=${code} desc=${desc} url=${validatedUrl}, ${retryDelay}ms 후 재시도`,
    );
    isShowingError = true;
    void win.loadURL(buildErrorDataUrl(validatedUrl, desc, retryDelay));
    if (pendingRetry) clearTimeout(pendingRetry);
    pendingRetry = setTimeout(() => {
      retryDelay = Math.min(retryDelay * 2, 60000);
      tryLoad();
    }, retryDelay);
  });

  win.webContents.on("did-finish-load", () => {
    if (!isShowingError) retryDelay = 5000;
  });

  tryLoad();
}

function buildErrorDataUrl(failedUrl: string, desc: string, nextRetryMs: number): string {
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>연결 중…</title>
<style>
:root { color-scheme: dark; }
body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center;
  background:#0f1219; color:#94a3b8; font:13px -apple-system,"Segoe UI",sans-serif; }
.box { text-align:center; padding:24px; max-width:280px; }
h1 { color:#f8fafc; font-size:14px; font-weight:600; margin:0 0 12px; }
p { font-size:11px; line-height:1.6; opacity:0.7; margin:6px 0; }
.dot { display:inline-block; width:6px; height:6px; background:#22d3ee; border-radius:50%;
  animation:pulse 1.5s infinite; margin-right:8px; vertical-align:middle; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
.detail { margin-top:14px; font-size:10px; opacity:0.4; word-break:break-all; }
</style></head>
<body><div class="box">
  <h1><span class="dot"></span>연결 중…</h1>
  <p>네트워크를 확인해주세요. ${Math.round(nextRetryMs / 1000)}초 후 자동 재시도합니다.</p>
  <p class="detail">${escapeHtml(desc)}<br/>${escapeHtml(failedUrl)}</p>
</div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Kill 스위치 ─── */

function showKillScreen(message?: string) {
  const text = message ?? "EPL 위젯 서비스가 종료되었습니다.";
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>서비스 종료</title>
<style>
body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center;
  background:#0f1219; color:#cbd5e1; font:14px -apple-system,"Segoe UI",sans-serif; }
.box { text-align:center; padding:24px; max-width:300px; }
h1 { color:#f8fafc; font-size:15px; margin:0 0 12px; }
p { font-size:12px; opacity:0.7; line-height:1.6; }
</style></head>
<body><div class="box">
  <h1>${escapeHtml(text)}</h1>
  <p>30초 뒤 자동으로 닫힙니다.</p>
</div></body></html>`;

  const win = new BrowserWindow({
    width: 360,
    height: 200,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    show: true,
    webPreferences: { sandbox: true },
  });
  win.setAlwaysOnTop(true, "normal");
  void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  setTimeout(() => app.quit(), 30_000);
}

/* ─── 창 Z-Order 헬퍼 ─── */

/**
 * Windows 한정: SetWindowPos(HWND_BOTTOM, ...) 로 위젯 창을 모든 다른 창 뒤로
 * 보낸다. Electron BrowserWindow API 에는 "맨 뒤로" 가 없어서 PowerShell 로
 * user32!SetWindowPos 를 직접 호출한다.
 */
function sendWindowToBack(win: BrowserWindow) {
  win.setAlwaysOnTop(false);
  win.blur();
  if (process.platform !== "win32") return;

  const handle = win.getNativeWindowHandle();
  const hwnd =
    handle.length >= 8
      ? handle.readBigInt64LE(0).toString()
      : handle.readInt32LE(0).toString();

  // HWND_BOTTOM = 1, SWP_NOSIZE|SWP_NOMOVE|SWP_NOACTIVATE = 0x0013
  const script =
    `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class W { [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int c, int d, uint f); }'; ` +
    `[W]::SetWindowPos([IntPtr]${hwnd}, [IntPtr]1, 0, 0, 0, 0, 0x13) | Out-Null`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err) => {
    if (err) log.warn(`[main] sendWindowToBack 실패: ${err.message}`);
  });
}

/* ─── IPC 핸들러 ─── */

function registerIpc(
  getWindow: () => BrowserWindow | null,
  getConfig: () => WidgetConfig | null,
) {
  // 라이프사이클
  ipcMain.on("widget:quit", () => app.quit());
  ipcMain.on("widget:restart", () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.on("widget:hide", () => getWindow()?.hide());
  ipcMain.on("widget:show", () => getWindow()?.show());
  ipcMain.on("widget:minimize", () => getWindow()?.hide());
  ipcMain.on("widget:reload", () => getWindow()?.webContents.reload());
  ipcMain.on("widget:navigate", (_e, url: string) => {
    if (typeof url !== "string") return;
    const cfg = getConfig();
    if (!cfg || !isAllowedHost(url, cfg.allowedNavigationHosts)) {
      log.warn(`[ipc] navigate 차단 (allowlist): ${url}`);
      return;
    }
    void getWindow()?.loadURL(url);
  });

  // 외부
  ipcMain.on("widget:open-external", (_e, url: string) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;
    void shell.openExternal(url);
  });

  // 창 조작
  ipcMain.on(
    "widget:set-bounds",
    (
      _e,
      b: { x?: number; y?: number; width?: number; height?: number },
    ) => {
      const win = getWindow();
      if (!win) return;
      const cur = win.getBounds();
      win.setBounds({
        x: typeof b.x === "number" ? b.x : cur.x,
        y: typeof b.y === "number" ? b.y : cur.y,
        width: clamp(typeof b.width === "number" ? b.width : cur.width, 100, 4000),
        height: clamp(typeof b.height === "number" ? b.height : cur.height, 100, 4000),
      });
    },
  );
  ipcMain.on("widget:set-always-on-top", (_e, value: boolean) => {
    const win = getWindow();
    if (!win) return;
    if (value) {
      win.setAlwaysOnTop(true, "normal");
    } else {
      win.setAlwaysOnTop(false);
      win.blur();
    }
  });
  ipcMain.on("widget:send-to-back", () => {
    const win = getWindow();
    if (!win) return;
    sendWindowToBack(win);
  });
  ipcMain.on("widget:set-opacity", (_e, value: number) => {
    if (typeof value !== "number") return;
    getWindow()?.setOpacity(clamp(value, 0, 1));
  });
  ipcMain.on(
    "widget:set-ignore-mouse",
    (_e, payload: { value: boolean; forward?: boolean }) => {
      getWindow()?.setIgnoreMouseEvents(payload.value, {
        forward: payload.forward,
      });
    },
  );
  ipcMain.on("widget:set-zoom", (_e, factor: number) => {
    if (typeof factor !== "number") return;
    getWindow()?.webContents.setZoomFactor(clamp(factor, 0.25, 4));
  });

  // 멀티 모니터
  ipcMain.handle("widget:get-displays", () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea,
      scaleFactor: d.scaleFactor,
      primary: d.id === primaryId,
    }));
  });
  ipcMain.on("widget:move-to-display", (_e, displayId: number) => {
    const target = screen.getAllDisplays().find((d) => d.id === displayId);
    const win = getWindow();
    if (!target || !win) return;
    const wb = win.getBounds();
    const { x, y, width, height } = target.workArea;
    win.setBounds({
      x: x + width - wb.width - 24,
      y: y + height - wb.height - 24,
      width: wb.width,
      height: wb.height,
    });
  });

  // 디버그 / 관측
  ipcMain.on("widget:open-devtools", () => {
    getWindow()?.webContents.openDevTools({ mode: "detach" });
  });
  ipcMain.on(
    "widget:log",
    (_e, payload: { level: string; message: string }) => {
      const lv = payload.level as "info" | "warn" | "error" | "debug";
      const fn = log[lv];
      if (typeof fn === "function") fn(`[renderer] ${payload.message}`);
    },
  );
  ipcMain.handle("widget:get-native-info", () => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    displayCount: screen.getAllDisplays().length,
  }));

  // 업데이트
  ipcMain.on("widget:force-update-check", () => {
    void forceUpdateCheck().catch((err) => log.error(err));
  });
  ipcMain.on("widget:apply-update-and-restart", () => {
    applyUpdateAndRestart();
  });

  // config
  ipcMain.handle("widget:get-config", () => getConfig());
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
