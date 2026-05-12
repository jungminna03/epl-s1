import { app, net } from "electron";
import log from "electron-log";
import fs from "node:fs";
import path from "node:path";

/**
 * 위젯 부트스트랩 — 인스톨러에 박힌 BOOTSTRAP_URL 하나만 frozen.
 * 그 외 URL/창 설정/킬스위치는 모두 원격 JSON 으로 빠진다.
 *
 * 부트 시퀀스:
 *  1) 원격 fetch (5초 타임아웃) → 성공 시 디스크 캐시
 *  2) 실패 시 마지막으로 성공한 디스크 캐시
 *  3) 그것도 실패하면 (생초기) 인스톨러에 박힌 기본값
 */

export type WindowAnchor =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

export type WindowConfig = {
  width: number;
  height: number;
  anchor: WindowAnchor;
  marginX: number;
  marginY: number;
  alwaysOnTop: boolean;
};

export type WidgetConfig = {
  /** 메인 창이 로드할 URL — 디스플레이 페이지 */
  widgetUrl: string;
  /** electron-updater 가 latest.yml 을 폴링할 호스트 */
  updateFeedUrl: string;
  /** 자동 업데이트 폴링 주기 (ms) */
  pollIntervalMs: number;
  /** 창 크기/위치/맨앞 고정 등 */
  window: WindowConfig;
  /** widget:navigate IPC 가 허용하는 호스트 화이트리스트. *.foo.com 형식 지원. */
  allowedNavigationHosts: string[];
  /** true 면 위젯이 "서비스 종료" 페이지를 띄우고 5초 뒤 quit. 비상 킬스위치. */
  kill: boolean;
  /** kill=true 일 때 화면에 표시할 메시지 */
  killMessage?: string;
};

/** 인스톨러에 같이 박히는 최후의 기본값. 원격/캐시 모두 실패 시 사용. */
const DEFAULT_CONFIG: WidgetConfig = {
  widgetUrl: "https://epl-s1.vercel.app/widget",
  updateFeedUrl: "https://m3vzlavafd1gvxn2.public.blob.vercel-storage.com",
  pollIntervalMs: 30 * 60 * 1000,
  window: {
    width: 400,
    height: 600,
    anchor: "bottom-right",
    marginX: 24,
    marginY: 24,
    alwaysOnTop: true,
  },
  allowedNavigationHosts: ["epl-s1.vercel.app", "*.vercel.app"],
  kill: false,
};

const FETCH_TIMEOUT_MS = 5000;
const CACHE_FILENAME = "widget-config.json";

export async function loadBootstrapConfig(
  bootstrapUrl: string,
  isDev: boolean,
): Promise<WidgetConfig> {
  // dev 에서는 원격 호출 안 하고 localhost 로 가리킴 — 실수로 prod 설정 받을 위험 차단
  if (isDev) {
    log.info("[bootstrap] dev 모드 — 로컬 기본값 사용");
    return {
      ...DEFAULT_CONFIG,
      widgetUrl: "http://localhost:3000/widget",
    };
  }

  const cachePath = path.join(app.getPath("userData"), CACHE_FILENAME);

  // 1) 원격 fetch
  try {
    const remote = await fetchRemoteConfig(bootstrapUrl);
    const merged = mergeConfig(DEFAULT_CONFIG, remote);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(merged, null, 2), "utf8");
    } catch (err) {
      log.warn(`[bootstrap] 캐시 쓰기 실패: ${(err as Error).message}`);
    }
    log.info("[bootstrap] 원격 config 로드 성공");
    return merged;
  } catch (err) {
    log.warn(`[bootstrap] 원격 fetch 실패: ${(err as Error).message}`);
  }

  // 2) 디스크 캐시
  try {
    if (fs.existsSync(cachePath)) {
      const raw = fs.readFileSync(cachePath, "utf8");
      const cached = JSON.parse(raw) as Partial<WidgetConfig>;
      log.info("[bootstrap] 캐시된 config 사용");
      return mergeConfig(DEFAULT_CONFIG, cached);
    }
  } catch (err) {
    log.warn(`[bootstrap] 캐시 읽기 실패: ${(err as Error).message}`);
  }

  // 3) 인스톨러 기본값
  log.info("[bootstrap] 기본 config 사용 (네트워크/캐시 모두 실패)");
  return DEFAULT_CONFIG;
}

function fetchRemoteConfig(url: string): Promise<Partial<WidgetConfig>> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, useSessionCookies: false });
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error(`타임아웃 (${FETCH_TIMEOUT_MS}ms)`));
    }, FETCH_TIMEOUT_MS);

    req.on("response", (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        clearTimeout(timer);
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve(JSON.parse(body) as Partial<WidgetConfig>);
        } catch (err) {
          reject(err as Error);
        }
      });
      res.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.end();
  });
}

function mergeConfig(
  base: WidgetConfig,
  override: Partial<WidgetConfig>,
): WidgetConfig {
  return {
    ...base,
    ...override,
    window: { ...base.window, ...(override.window ?? {}) },
    allowedNavigationHosts:
      override.allowedNavigationHosts ?? base.allowedNavigationHosts,
  };
}

/** 호스트 화이트리스트 검사 (`*.foo.com` 형식 지원) */
export function isAllowedHost(url: string, hosts: string[]): boolean {
  try {
    const u = new URL(url);
    return hosts.some((h) => {
      if (h.startsWith("*.")) {
        return u.hostname === h.slice(2) || u.hostname.endsWith(h.slice(1));
      }
      return u.hostname === h;
    });
  } catch {
    return false;
  }
}
