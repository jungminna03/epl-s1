# 관리자 공지 목록 활성/비활성 탭 분리

**날짜:** 2026-06-04
**대상 파일:** `src/app/admin/page.tsx`
**관련 헬퍼:** `src/lib/categories.ts` (`getEffectivePeriod`, `isNoticeVisible`)

## 문제

`/admin` 의 공지 목록은 활성(현재 게시 중), 예정(시작일이 미래), 종료(종료일이 지남) 공지를 한 리스트에 섞어서 보여준다. 관리자는 "지금 디스플레이에 노출되는 게 뭔지" 빠르게 확인할 수 없고, 오래된 종료 공지가 위에 떠 있어 정리가 어렵다.

## 해결책

목록 상단에 **4탭 + 카운트 뱃지** 를 두고, 한 번에 한 상태만 보여준다.

### 탭 구성

| 탭 | 의미 | 판정 |
| --- | --- | --- |
| 전체 | 모든 공지 | 필터 없음 |
| **활성** (기본 진입) | 현재 게시 중 | `start ≤ now ≤ end` (= `isNoticeVisible(notice)`) |
| 예정 | 아직 시작 안 함 | `now < start` |
| 종료 | 종료일 지남 | `now > end` |

`start` / `end` 는 기존 `getEffectivePeriod(notice)` 결과를 그대로 사용. 즉 `endDate` 가 비어 있으면 `start + AUTO_PERIOD_DAYS(7일)` 이 자동 종료일.

### 동작

- **기본 진입:** `활성` 탭.
- **URL 동기화:** URL 해시(`#all`, `#active`, `#upcoming`, `#expired`)로 현재 탭을 표현. 새로고침/북마크 시 동일 탭이 복원됨. 해시가 없거나 잘못된 값이면 `활성`.
- **카운트 뱃지:** 각 탭 라벨 옆에 해당 상태의 공지 개수.
- **정렬:** 탭 내부는 기존과 동일하게 `createdAt` 내림차순.
- **빈 상태:** 탭별로 다른 메시지 — "활성 공지가 없습니다", "예정 공지가 없습니다", "종료된 공지가 없습니다", "등록된 공지가 없습니다".
- **등록/수정 후:** 현재 탭을 유지한다. 자동으로 다른 탭으로 점프시키지 않음.
- **헤더 부제 변경:** 기존 `총 N건` 표시는 탭 카운트로 대체.

### 시간 캐시

- 탭 카운트 계산은 컴포넌트 마운트 시점의 `Date.now()` 를 한 번 잡아서 사용. 사용자가 새로고침하지 않는 한 굳이 분 단위로 재계산하지 않는다. 이는 데이터가 InstantDB 실시간 구독으로 들어올 때 같이 갱신되므로, 별도 타이머는 두지 않는다.
- 결정 근거: 종료 시각이 분 단위로 정확할 필요 없음. 다음 mutation 또는 새로고침에서 자연스럽게 보정됨.

### 레이아웃

- **데스크톱:** 헤더 바로 아래, 리스트 위쪽에 탭 행. 알약(pill) 모양 버튼, 활성 탭은 파란색 채움, 나머지는 회색 외곽선.
- **모바일(터치):** 동일한 탭 UI. 가로 스크롤 가능한 한 줄 pill row. `MobileListView` 안에도 같이 들어감.

## 구조

탭 상태와 필터링 로직은 부모 `Dashboard` 컴포넌트에서 관리한다.

```
Dashboard
├─ activeTab: 'all' | 'active' | 'upcoming' | 'expired'  (URL 해시와 동기화)
├─ filteredNotices: useMemo(() => filter(notices, activeTab, now))
├─ tabCounts: useMemo(() => count(notices, now))
├─ <NoticeTabs activeTab counts onChange />   ← 새 컴포넌트
└─ desktop: <section>{ filteredNotices.map(NoticeRow) }</section>
   touch:   <MobileListView notices={filteredNotices} />
```

### 새 모듈

**`src/lib/notice-status.ts`** — 분류 헬퍼.

```ts
export type NoticeStatus = 'active' | 'upcoming' | 'expired';
export type NoticeTab = 'all' | NoticeStatus;

export function getNoticeStatus(notice: Notice, now: number): NoticeStatus;
export function filterByTab(notices: Notice[], tab: NoticeTab, now: number): Notice[];
export function countByStatus(notices: Notice[], now: number): Record<NoticeStatus, number>;
```

`getEffectivePeriod` 를 사용해 한 곳에서만 판정한다.

### 새 컴포넌트

**`NoticeTabs`** — `src/app/admin/page.tsx` 안에 함께 정의 (다른 admin 서브 컴포넌트들과 동일 패턴).

- props: `activeTab`, `counts: { active, upcoming, expired, total }`, `onChange(tab)`
- 데스크톱/모바일 양쪽에서 재사용.

### URL 해시 동기화

- 마운트 시 `window.location.hash` 읽어 초기 탭 결정.
- 탭 변경 시 `history.replaceState(null, '', '#' + tab)` — 히스토리 스택을 더럽히지 않는다.
- `hashchange` 이벤트 리스너 등록해 외부에서 URL 바뀌어도 따라감.

## 영향 범위 / 변경되지 않는 것

- DB 스키마 변경 없음.
- `getEffectivePeriod`, `isNoticeVisible` 등 기존 헬퍼 동작 변경 없음.
- 디스플레이(`/display`, `/widget`) 측 동작 변경 없음 — 관리자 페이지 UI 정리만.
- `NoticeRow`, `NoticeForm`, `MobileListView` 의 내부 구조 변경 없음 — 이들에게 넘기는 `notices` 만 필터된 배열로 바뀐다.

## 테스트 / 검증

- 수동 검증:
  1. `/admin` 진입 시 활성 탭이 기본 선택. URL 해시 `#active` 자동 부여 OR 비어 있어도 활성 선택.
  2. `#expired` 로 직접 접속 → 종료 탭이 선택된 상태.
  3. 각 탭 카운트와 실제 표시 개수 일치.
  4. 빈 탭에서 탭별 빈 상태 메시지.
  5. 모바일(touch 레이아웃)에서도 탭 동작.
  6. 종료 탭에서 공지 새로 등록 → 종료 탭 유지(자동 점프 X), 활성 탭에 새 공지가 추가됨.
  7. 종료 공지 편집 → 폼은 정상 동작, 저장 후 현재 탭 유지.
- `npm run build`, `npx tsc --noEmit` 통과.

## 배포

- 렌더러 변경만 (Vercel). Electron 셸 변경 없음.
- `src/app/admin/page.tsx`, `src/lib/notice-status.ts` 만 바뀜.
- `vercel --prod` 한 번이면 끝.
