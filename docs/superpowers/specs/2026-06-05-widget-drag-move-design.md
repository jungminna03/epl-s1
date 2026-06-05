# 위젯 드래그 이동 (상단 그립) 디자인 스펙

날짜: 2026-06-05
상태: 승인됨 (A안 — 렌더러 수동 드래그)

## 목표

배포 모드 위젯을 사용자가 **옮길 수는 있게** 한다. 단:

- **크기 조절 불가** — 기존 `resizable:false` 유지
- **닫기/없애기 불가** — 기존 `allowClose:false` 유지
- **화면 밖으로 한 프레임도 못 나감** — 모든 이동 좌표는 전송 전에 work area 로 클램프
- **위치는 저장하지 않음** — 재시작하면 기존 우하단 앵커로 복귀

## 왜 A안 (렌더러 수동 드래그) 인가

설치본 `main.ts` 에 `widget:set-bounds`(partial 허용) / `widget:get-displays` IPC 가
이미 깔려 있다. 따라서 **Electron 재배포 없이 Vercel 배포만으로** 전 PC 에 즉시
적용된다. 대안이었던 B안 (`-webkit-app-region: drag` + main `will-move` 클램프) 은
네이티브 부드러움이 장점이지만 새 인스톨러 릴리스(버전 업 + 30~60분 롤아웃) 와
`movable:true` 전환 검증이 필요해 기각.

## 구성

### `src/components/widget/DragGrip.tsx` (신규)

- 위젯 헤더 위에 얇은 그립 바 (가운데 점 패턴, hover 시 밝아짐, `cursor: grab`)
- `window.epl?.setBounds` 가 없으면 (브라우저 미리보기) 렌더링하지 않음
- 드래그 흐름:
  1. `pointerdown` → `setPointerCapture`, 시작 시점의 창 위치(`window.screenX/Y`)·
     포인터 위치(`e.screenX/Y`)·창 크기(`window.outerWidth/Height`) 기록,
     `epl.getDisplays()` 로 work area 목록 캐시
  2. `pointermove` → 델타로 목표 `(x, y)` 계산 → `clampToWorkArea` 통과 →
     rAF 당 1회 `epl.setBounds({ x, y })` (width/height 미포함 → 크기 불변)
  3. `pointerup` / `pointercancel` → 종료
- 포커스 불필요 (pointer 이벤트만 사용) → `focusable:false` 정책과 충돌 없음.
  `setFocusable` 호출하지 않는다.

### `clampToWorkArea(x, y, w, h, displays)` — 순수 함수

- 목표 창 중심에 가장 가까운 디스플레이의 `workArea` 를 선택
- `x ∈ [wa.x, wa.x + wa.width − w]`, `y ∈ [wa.y, wa.y + wa.height − h]` 로 클램프
- 클램프 전 좌표는 절대 IPC 로 전송되지 않음 — "한 프레임도 못 나감" 보장.
  창을 옮기는 다른 코드 경로가 없으므로 이것으로 충분.

### 버전

`WIDGET_VERSION` → `V.2026.6.7`

## 검증

- `npx tsc --noEmit` + `npm run build` 통과 (프로젝트에 테스트 러너 없음 —
  의존성 사전 승인 룰에 따라 추가하지 않음)
- dev Electron (`npm run electron:dev`) 에서 수동 검증:
  드래그 이동 / 모서리 클램프 / 크기 불변 / 브라우저 미리보기에서 그립 미표시

## 배포

`src/**` 만 변경 → **Vercel 만** (`vercel --prod`). Electron 릴리스 불필요.
