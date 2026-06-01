import { BrowserWindow, screen, shell } from "electron";
import path from "node:path";
import { APP_CONFIG } from "./config";
import type { WidgetConfig } from "./bootstrap";

type WindowAnchor = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

type InteractiveWin = BrowserWindow & { __forceBlur?: () => void };

/**
 * 위젯 창의 "포커스 가능 여부" 를 토글.
 *
 * 배포 모드는 `focusable:false` + focus→blur 핸들러로 위젯이 절대 포커스를 못
 * 잡게 만들어 둔다 (다른 창에 가려져 있어야 함). 그런데 native `<select>` 드롭다운,
 * `<input>` IME, 컨텍스트 메뉴 등은 윈도우가 포커스를 잡아야만 동작한다. 그래서
 * 사용자 입력이 필요한 패널(예: 오늘의 운세) 이 열리는 동안만 한시적으로
 * interactive(true) 로 전환했다가, 닫힐 때 원복한다.
 *
 * dev 모드는 이미 focusable:true 라 사실상 no-op.
 */
export function setWidgetInteractive(win: BrowserWindow, value: boolean): void {
  const w = win as InteractiveWin;
  if (value) {
    if (w.__forceBlur) win.removeListener("focus", w.__forceBlur);
    win.setFocusable(true);
    win.focus();
  } else {
    win.setFocusable(false);
    if (w.__forceBlur) {
      // 중복 등록 방지를 위해 한번 떼고 다시 붙임.
      win.removeListener("focus", w.__forceBlur);
      win.on("focus", w.__forceBlur);
      win.blur();
    }
  }
}

export function createWidgetWindow(config: WidgetConfig): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh, x: dx, y: dy } = display.workArea;
  const { width, height } = APP_CONFIG.widget;
  const { anchor, marginX, marginY } = APP_CONFIG.position;

  const { x, y } = computePosition(dx, dy, sw, sh, width, height, anchor, marginX, marginY);

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    // SYSTEM_STATEMENT.md: 400×600px 고정
    resizable: APP_CONFIG.windowBehavior.resizable,
    maximizable: false,
    minimizable: false,  // 최소화 버튼 비활성화
    fullscreenable: false,
    skipTaskbar: !APP_CONFIG.windowBehavior.showInTaskbar,
    alwaysOnTop: APP_CONFIG.windowBehavior.alwaysOnTop,
    show: false,
    // 배포 시 창이 다른 창에 가려지도록 설정
    focusable: APP_CONFIG.isDev, // 배포 시 포커스 불가
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 배포 모드: 창을 항상 맨 뒤로 (다른 창에 가려지도록)
  if (APP_CONFIG.windowBehavior.stayInBackground) {
    win.setAlwaysOnTop(false);
    // Z-Order 조정: 창을 맨 뒤로
    win.setPosition(x, y, false);
    // 클릭 시 앞으로 오지 않도록
    win.setSkipTaskbar(true);
  }

  win.setVisibleOnAllWorkspaces(true);
  win.once("ready-to-show", () => {
    win.show();
    // 배포 모드: 활성화 방지
    if (APP_CONFIG.windowBehavior.stayInBackground) {
      win.blur();
      // 다른 창 뒤로 보내기
      setTimeout(() => {
        win.setPosition(x, y, false);
      }, 100);
    }
  });

  // 배포 모드: 포커스 시도 차단.
  // 핸들러 참조를 win 에 보관해야 setWidgetInteractive 가 일시적으로 떼낼 수 있다.
  if (APP_CONFIG.windowBehavior.stayInBackground) {
    const forceBlur = () => win.blur();
    (win as InteractiveWin).__forceBlur = forceBlur;
    win.on("focus", forceBlur);
  }

  // 개발 모드: 이동 가능
  if (APP_CONFIG.windowBehavior.movable) {
    // 개발 모드에서만 창 이동 허용 (기본적으로 Electron frameless는 드래그 불가)
  } else {
    // 배포 모드: 창 이동 차단
    win.setMovable(false);
  }

  // 배포 모드: Alt+F4 차단
  if (!APP_CONFIG.windowBehavior.allowClose) {
    win.on("close", (event) => {
      event.preventDefault();
    });
  }

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
