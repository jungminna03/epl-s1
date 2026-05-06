import { BrowserWindow, Menu, Tray, app, nativeImage } from "electron";
import path from "node:path";

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  // electron-resources/icon.ico를 그대로 사용; 누락 시 빈 아이콘.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(__dirname, "../electron-resources/icon.ico");

  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();

  const tray = new Tray(image);
  tray.setToolTip("EPL 공지사항");

  const rebuild = () => {
    const win = getWindow();
    const visible = win?.isVisible() ?? false;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? "위젯 숨기기" : "위젯 보이기",
          click: () => {
            const w = getWindow();
            if (!w) return;
            if (w.isVisible()) w.hide();
            else w.show();
          },
        },
        {
          label: "맨 위 고정",
          type: "checkbox",
          checked: getWindow()?.isAlwaysOnTop() ?? false,
          click: (item) => {
            const w = getWindow();
            w?.setAlwaysOnTop(item.checked, "normal");
          },
        },
        { type: "separator" },
        { label: "종료", role: "quit" },
      ]),
    );
  };

  rebuild();
  tray.on("click", () => {
    const w = getWindow();
    if (!w) return;
    if (w.isVisible()) w.hide();
    else w.show();
    rebuild();
  });

  return tray;
}
