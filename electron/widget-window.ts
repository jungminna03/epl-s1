import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";
import type { WidgetConfig, WindowAnchor } from "./bootstrap";

export function createWidgetWindow(config: WidgetConfig): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh, x: dx, y: dy } = display.workArea;
  const { width, height, anchor, marginX, marginY, alwaysOnTop } = config.window;

  const { x, y } = computePosition(dx, dy, sw, sh, width, height, anchor, marginX, marginY);

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    // setBounds IPC 가 있으니 풀어둠. 사용자가 마우스로 리사이즈하지는 못해도 IPC 로 가능.
    resizable: true,
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

  if (alwaysOnTop) win.setAlwaysOnTop(true, "normal");
  win.setVisibleOnAllWorkspaces(true);
  win.once("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

function computePosition(
  dx: number,
  dy: number,
  sw: number,
  sh: number,
  ww: number,
  wh: number,
  anchor: WindowAnchor,
  mx: number,
  my: number,
): { x: number; y: number } {
  switch (anchor) {
    case "top-left":
      return { x: dx + mx, y: dy + my };
    case "top-right":
      return { x: dx + sw - ww - mx, y: dy + my };
    case "bottom-left":
      return { x: dx + mx, y: dy + sh - wh - my };
    case "bottom-right":
      return { x: dx + sw - ww - mx, y: dy + sh - wh - my };
    case "center":
      return {
        x: dx + Math.round((sw - ww) / 2),
        y: dy + Math.round((sh - wh) / 2),
      };
  }
}
