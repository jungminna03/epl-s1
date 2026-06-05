"use client";

import { useCallback, useRef } from "react";

/**
 * 마우스 드래그로 overflow 스크롤 컨테이너를 실제로 스크롤하게 만드는 훅.
 * 놓으면 관성 스크롤, 엣지에선 고무줄(러버밴드) 오버스크롤로 튕긴다.
 *
 * 왜 필요한가:
 * - 위젯 창은 배포 모드에서 `focusable:false` 라 환경에 따라 휠 이벤트가 위젯으로
 *   라우팅되지 않을 수 있고, native 스크롤은 마우스 드래그로는 움직이지 않는다.
 * - 디스플레이(터치 TV)는 터치 native 스크롤이 동작하므로 mouse 포인터만 처리한다
 *   (touch 까지 잡으면 native 스크롤과 이중 처리됨).
 *
 * 동작:
 * - 5px 이상 움직이면 드래그로 판정하고 pointer capture 를 잡는다.
 *   capture 가 잡히면 이후 click 이 자식 버튼이 아닌 컨테이너로 발화돼
 *   "드래그 후 오클릭" 이 자연히 차단된다. 5px 미만은 일반 클릭으로 통과.
 * - 스크롤 끝을 넘어 끌면 저항이 걸린 고무줄 변위가 생기고, 놓으면 스프링 복귀.
 * - 관성 스크롤이 엣지에 부딪히면 남은 속도만큼 살짝 튕긴 뒤 복귀.
 *
 * 반환값은 ref 콜백 — 대상이 조건부 렌더링으로 갈아끼워져도 (예: 위젯 상세 ↔
 * 운세/쿠키 패널 전환) 노드별로 리스너를 재부착한다.
 * 주의: 고무줄 transform 은 컨테이너의 **첫 자식**에 건다 — 내용물이 여러
 * 형제로 흩어져 있으면 단일 래퍼 div 로 감싸서 넘길 것.
 */
export function useDragScroll(): (el: HTMLElement | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);

  return useCallback((el: HTMLElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!el) return;

    const DRAG_THRESHOLD_PX = 5;
    const MOMENTUM_DECAY = 0.94;
    const MIN_VELOCITY_PX_PER_FRAME = 0.4;
    /** 엣지 너머로 끌 때 저항 계수 (작을수록 뻑뻑) */
    const RUBBER_FACTOR = 0.35;
    /** 고무줄 최대 변위 px */
    const RUBBER_MAX_PX = 140;
    /** 놓았을 때 원위치 복귀 시간 */
    const RUBBER_RETURN_MS = 280;
    /** 관성이 엣지에 부딪혔을 때 튕김 크기 계수 */
    const BOUNCE_FACTOR = 10;
    const BOUNCE_MAX_PX = 70;

    let pointerId = -1;
    let dragging = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0; // px/ms — 양수 = 아래로 스크롤되는 방향
    let raf = 0;
    /** +: 맨 위에서 아래로 더 끈 양(px), -: 맨 아래에서 위로 더 끈 양 */
    let overscroll = 0;

    // 컨테이너 자체를 움직이면 패널 테두리까지 끌려가므로 내용물(첫 자식)에 건다.
    const rubberTarget = () =>
      (el.firstElementChild as HTMLElement | null) ?? el;

    const setRubber = (px: number, animate: boolean) => {
      const t = rubberTarget();
      t.style.transition = animate
        ? `transform ${RUBBER_RETURN_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
        : "";
      t.style.transform = px === 0 ? "" : `translateY(${px}px)`;
    };

    const rubberOffset = () => {
      const sign = Math.sign(overscroll);
      return (
        sign * Math.min(Math.abs(overscroll) * RUBBER_FACTOR, RUBBER_MAX_PX)
      );
    };

    const stopMomentum = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    /** 드래그 이동량(dy)을 고무줄/실스크롤에 배분 */
    const applyDelta = (rawDy: number) => {
      let dy = rawDy;
      if (overscroll !== 0) {
        const next = overscroll + dy;
        if (next === 0 || Math.sign(next) === Math.sign(overscroll)) {
          overscroll = next;
          setRubber(rubberOffset(), false);
          return;
        }
        // 고무줄 소진 — 남은 이동량은 실제 스크롤로
        overscroll = 0;
        setRubber(0, false);
        dy = next;
      }
      const before = el.scrollTop;
      el.scrollTop = before - dy;
      const leftover = dy - (before - el.scrollTop);
      if (leftover !== 0) {
        overscroll = leftover;
        setRubber(rubberOffset(), false);
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      stopMomentum();
      pointerId = e.pointerId;
      dragging = false;
      startY = lastY = e.clientY;
      lastT = performance.now();
      velocity = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (!dragging) {
        if (Math.abs(e.clientY - startY) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        try {
          el.setPointerCapture(pointerId);
        } catch {
          /* 일부 환경에서 포인터가 이미 사라졌으면 무시 */
        }
      }
      const dy = e.clientY - lastY;
      lastY = e.clientY;
      applyDelta(dy);
      const t = performance.now();
      const dt = t - lastT;
      if (dt > 0) velocity = 0.7 * velocity + 0.3 * (-dy / dt);
      lastT = t;
    };

    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = -1;
      if (!dragging) return;
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }

      // 고무줄을 잡은 채 놓으면 스프링 복귀 (관성 생략)
      if (overscroll !== 0) {
        overscroll = 0;
        setRubber(0, true);
        return;
      }

      // 관성 스크롤 — 엣지에 부딪히면 남은 속도만큼 살짝 튕긴 뒤 복귀
      let v = velocity * 16; // px/ms → px/frame(≈16ms) 근사
      const step = () => {
        if (Math.abs(v) < MIN_VELOCITY_PX_PER_FRAME) {
          raf = 0;
          return;
        }
        const before = el.scrollTop;
        el.scrollTop = before + v;
        if (el.scrollTop === before) {
          // 엣지 도달 — v>0(아래로) 이면 위로, v<0 이면 아래로 튕김
          const off = Math.max(
            -BOUNCE_MAX_PX,
            Math.min(BOUNCE_MAX_PX, -v * BOUNCE_FACTOR),
          );
          setRubber(off, false);
          raf = requestAnimationFrame(() => {
            raf = 0;
            setRubber(0, true);
          });
          return;
        }
        v *= MOMENTUM_DECAY;
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    cleanupRef.current = () => {
      stopMomentum();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
    };
  }, []);
}
