import { BrowserWindow, Menu, Tray, app, nativeImage, dialog, screen } from "electron";
import path from "node:path";
import { APP_CONFIG } from "./config";

export function createTray(getWindow: () => BrowserWindow | null): Tray {
  // electron-resources/icon.ico를 그대로 사용; 누락 시 빈 아이콘.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(__dirname, "../electron-resources/icon.ico");

  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();

  const tray = new Tray(image);
  tray.setToolTip("게임소프트웨어학과 공지사항");

  const rebuild = () => {
    const win = getWindow();
    const visible = win?.isVisible() ?? false;

    // SYSTEM_STATEMENT.md 기반 메뉴 구성
    const menuItems: Electron.MenuItemConstructorOptions[] = [
      {
        label: "공지사항 새로고침",
        click: () => {
          const w = getWindow();
          w?.webContents.reload();
        },
      },
    ];

    // 개발 모드: 맨 위 고정 토글 가능
    if (APP_CONFIG.isDev) {
      menuItems.push({
        label: "맨 위 고정",
        type: "checkbox",
        checked: getWindow()?.isAlwaysOnTop() ?? false,
        click: (item) => {
          const w = getWindow();
          w?.setAlwaysOnTop(item.checked, "normal");
        },
      });
    }

    // 개발 모드: 위치 초기화
    if (APP_CONFIG.isDev) {
      menuItems.push({
        label: "위치 초기화",
        click: () => {
          const w = getWindow();
          if (!w) return;
          const display = screen.getPrimaryDisplay();
          const { width: sw, height: sh, x: dx, y: dy } = display.workArea;
          const { width, height } = APP_CONFIG.widget;
          const { marginX, marginY } = APP_CONFIG.position;
          w.setPosition(
            dx + sw - width - marginX,
            dy + sh - height - marginY,
          );
        },
      });
    }

    menuItems.push(
      { type: "separator" },
      {
        label: `버전 정보 (V.${app.getVersion()})`,
        enabled: false,
      },
    );

    // 종료: 개발 모드는 직접 종료, 배포 모드는 관리자 권한 필요
    if (APP_CONFIG.isDev) {
      menuItems.push({ label: "종료", role: "quit" });
    } else {
      menuItems.push({
        label: "종료 (관리자 권한 필요)",
        click: () => {
          // 배포 모드: 종료 확인 다이얼로그
          const result = dialog.showMessageBoxSync({
            type: "warning",
            title: "NoticeWidget 종료",
            message: "정말로 NoticeWidget을 종료하시겠습니까?",
            detail: "배포 환경에서는 관리자 권한이 필요합니다.",
            buttons: ["종료", "취소"],
            defaultId: 1,
          });
          if (result === 0) {
            app.quit();
          }
        },
      });
    }

    tray.setContextMenu(Menu.buildFromTemplate(menuItems));
  };

  rebuild();

  // 트레이 클릭: 개발 모드에서만 보이기/숨기기 가능
  // 배포 모드: 창이 배경에 머무르므로 클릭해도 앞으로 안 나옴
  tray.on("click", () => {
    if (!APP_CONFIG.isDev) return;
    const w = getWindow();
    if (!w) return;
    if (w.isVisible()) w.hide();
    else w.show();
    rebuild();
  });

  return tray;
}
