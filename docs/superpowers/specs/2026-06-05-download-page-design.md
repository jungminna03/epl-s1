# 위젯 다운로드 페이지 분리 — 디자인 스펙

날짜: 2026-06-05
상태: 승인됨 (비주얼 컴페니언 브레인스토밍으로 결정)

## 배경 / 문제

- 현재 도메인 루트(`/`)에 버튼 3개: 디스플레이 보기 / 관리자 로그인 / 위젯 다운로드.
- `위젯 다운로드`는 `/download` (route handler) 로 직링크 → GitHub Releases 최신 `.exe` 로 302. 클릭 즉시 다운로드라 위젯이 뭔지 모르는 사람에겐 설명이 0.
- 위젯을 소개하면서 다운로드받게 하는 전용 페이지가 필요 (GitHub Desktop 다운로드 페이지 콘셉트).

## 결정 사항

| 질문 | 결정 |
| --- | --- |
| 다운로드 페이지 레이아웃 | **B — 좌우 스플릿형** (왼쪽 카피+버튼, 오른쪽 위젯 미리보기) |
| 위젯 미리보기 방식 | **라이브 iframe** — 실제 `/widget` 을 iframe 으로 임베드 |
| 루트 페이지 진입점 | **C — 작은 텍스트 링크** (메인 버튼 줄에서 제거, 아래 조용한 링크) |

## 라우팅

| 경로 | before | after |
| --- | --- | --- |
| `/download` | route.ts — latest.yml 파싱 후 .exe 302 | **page.tsx — 다운로드 랜딩 페이지** |
| `/download/latest` | (없음) | **route.ts — 기존 302 로직 그대로 이동** |

- 기존 `src/app/download/route.ts` 는 코드 변경 없이 `src/app/download/latest/route.ts` 로 이동.
- 페이지의 다운로드 버튼 href = `/download/latest` → 클릭 즉시 최신 인스톨러 다운로드.
- 과거에 `/download` 링크를 공유받은 사용자는 즉시 다운로드 대신 페이지를 보게 됨 — 의도된 개선.

## 다운로드 페이지 (`src/app/download/page.tsx`)

- 다크 테마 `#0f1219`, 위젯/루트와 동일한 시안→블루→퍼플 그라데이션 톤.
- **왼쪽 컬럼**:
  - 라벨: `CAMPUS NOTICE WIDGET` (uppercase tracking, slate-500)
  - 헤드라인: 위젯 소개 카피 (예: "바탕화면에서 바로 보는 공지")
  - 설명 1~2줄: 자동 업데이트 / 바탕화면 상주 / 실시간 공지
  - 큰 그라데이션 다운로드 버튼: `⬇ Windows용 다운로드` → `/download/latest`
  - 캡션: `vX.Y.Z · Windows 10/11` (버전은 서버에서 fetch, 실패 시 버전 부분 생략)
- **오른쪽 컬럼**:
  - 실제 `/widget` 라이브 iframe. 위젯 실제 비율(세로형) 프레임에 담음.
  - `pointer-events: none` 으로 상호작용 차단 — 순수 미리보기.
  - 프레임에 위젯 카드와 같은 그라데이션 보더 처리.
- **버전 fetch**: 서버 컴포넌트에서 `latest.yml` 을 fetch (`next: { revalidate: 600 }`), `version:` 필드 파싱. 실패해도 페이지는 정상 렌더 (버전 캡션만 생략).
- **반응형**: 모바일에서 세로 스택 (카피 위 → 미리보기 아래).

## 루트 페이지 (`src/app/page.tsx`)

- `위젯 다운로드 ↓` 버튼 제거 → 버튼 2개(디스플레이 보기 / 관리자 로그인)만 유지.
- 버튼 줄 아래에 작은 시안색 텍스트 링크 추가: `🖥️ 데스크톱 위젯도 있어요 →` → `/download`.

## 배포 영향

- `src/**` 만 변경 → **Vercel 만 배포** (`vercel --prod`). Electron 셸 무관.

## 에러 처리

- `latest.yml` fetch 실패: 버전 캡션 생략, 다운로드 버튼은 그대로 동작 (`/download/latest` 가 자체적으로 502 메시지 반환).
- iframe 로드 실패(오프라인 등): 브라우저 기본 동작에 맡김 — 별도 폴백 없음 (같은 origin 이라 사실상 페이지가 떴으면 위젯도 뜸).

## 테스트 / 검증

- `npm run build` + `npx tsc --noEmit` 통과.
- `/download` 페이지 렌더, 버튼 href, iframe 동작 수동 확인.
- `/download/latest` 가 .exe 로 302 하는지 확인.
