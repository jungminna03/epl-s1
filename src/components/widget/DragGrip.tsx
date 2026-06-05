"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 위젯 상단 드래그 그립.
 *
 * 배포 모드 위젯 창은 `movable:false` + frameless 라 OS 드래그가 불가능하다.
 * 대신 이 그립에서 pointer 델타를 계산해 기존 `widget:set-bounds` IPC 로
 * 창을 직접 옮긴다 (Electron 재배포 불필요 — 렌더러만으로 동작).
 *
 * 불변 조건:
 * - setBounds 에 width/height 를 절대 포함하지 않음 → 크기 불변
 * - 모든 좌표는 전송 전에 clampToWorkArea 통과 → 화면 밖으로 한 프레임도 못 나감
 * - 위치는 저장하지 않음 → 재시작 시 기존 우하단 앵커로 복귀
 * - pointer 이벤트만 사용 (포커스 불필요) → focusable:false 정책과 충돌 없음
 */

type Bounds = { x: number; y: number; width: number; height: number };

type DisplayInfo = {
  id: number;
  bounds: Bounds;
  workArea: Bounds;
  scaleFactor: number;
  primary: boolean;
};

type EplWindowApi = {
  setBounds?: (b: Partial<Bounds>) => void;
  getDisplays?: () => Promise<DisplayInfo[]>;
};

function getEpl(): EplWindowApi | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { epl?: EplWindowApi }).epl;
}

/**
 * 목표 창 위치 (x, y) 를 화면 안으로 클램프한다.
 * 창 중심에 가장 가까운 디스플레이의 workArea 를 기준으로,
 * 창 전체가 workArea 안에 들어오도록 x/y 를 자른다.
 */
export function clampToWorkArea(
  x: number,
  y: number,
  w: number,
  h: number,
  displays: DisplayInfo[],
): { x: number; y: number } {
  if (displays.length === 0) return { x, y };

  const cx = x + w / 2;
  const cy = y + h / 2;
  let nearest = displays[0].workArea;
  let nearestDist = Infinity;
  for (const d of displays) {
    const wa = d.workArea;
    // workArea 중심까지의 거리 제곱 (가장 가까운 디스플레이 선택용)
    const dx = cx - (wa.x + wa.width / 2);
    const dy = cy - (wa.y + wa.height / 2);
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = wa;
    }
  }

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), Math.max(min, max));
  return {
    x: clamp(x, nearest.x, nearest.x + nearest.width - w),
    y: clamp(y, nearest.y, nearest.y + nearest.height - h),
  };
}

type DragState = {
  pointerId: number;
  startPointerX: number;
  startPointerY: number;
  startWinX: number;
  startWinY: number;
  winW: number;
  winH: number;
  displays: DisplayInfo[];
};

export default function DragGrip() {
  // SSR/하이드레이션 안전: 마운트 후 epl 존재 여부 확인
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const epl = getEpl();
    setAvailable(Boolean(epl?.setBounds && epl?.getDisplays));
  }, []);

  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const flush = useCallback(() => {
    rafRef.current = null;
    const target = pendingRef.current;
    if (!target) return;
    pendingRef.current = null;
    getEpl()?.setBounds?.(target); // x/y 만 — 크기 불변
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const epl = getEpl();
      if (!epl?.setBounds || !epl.getDisplays) return;

      const state: DragState = {
        pointerId: e.pointerId,
        startPointerX: e.screenX,
        startPointerY: e.screenY,
        startWinX: window.screenX,
        startWinY: window.screenY,
        winW: window.outerWidth,
        winH: window.outerHeight,
        displays: [],
      };
      dragRef.current = state;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);

      // 드래그 시작 시점에 디스플레이 목록 1회 캐시 (드래그 중 변동은 무시)
      void epl.getDisplays().then((displays) => {
        if (dragRef.current === state) state.displays = displays;
      });
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragRef.current;
      if (!state || e.pointerId !== state.pointerId) return;
      // 디스플레이 목록 도착 전에는 이동하지 않음 — 클램프 없는 좌표는 전송 금지
      if (state.displays.length === 0) return;

      const x = state.startWinX + (e.screenX - state.startPointerX);
      const y = state.startWinY + (e.screenY - state.startPointerY);
      pendingRef.current = clampToWorkArea(
        x,
        y,
        state.winW,
        state.winH,
        state.displays,
      );
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  const handlePointerEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragRef.current;
      if (!state || e.pointerId !== state.pointerId) return;
      dragRef.current = null;
      setDragging(false);
    },
    [],
  );

  if (!available) return null;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="flex shrink-0 select-none items-center justify-center transition-colors"
      style={{
        height: "2.4vh",
        marginBottom: "0.6vh",
        borderRadius: "1vh",
        cursor: dragging ? "grabbing" : "grab",
        background: dragging ? "rgba(148,163,184,0.12)" : "transparent",
        touchAction: "none",
      }}
      title="잡고 끌어서 위젯 옮기기"
      aria-label="위젯 이동 그립"
    >
      <div
        className="flex items-center"
        style={{ gap: "0.7vh", opacity: dragging ? 0.9 : 0.45 }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="rounded-full bg-slate-400"
            style={{ width: "0.55vh", height: "0.55vh" }}
          />
        ))}
      </div>
    </div>
  );
}
