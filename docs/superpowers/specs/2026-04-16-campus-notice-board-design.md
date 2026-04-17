---
title: 캠퍼스 공지사항 (실시간 디지털 사이니지) — 설계 명세
date: 2026-04-16
status: approved
---

# 캠퍼스 공지사항 (실시간 디지털 사이니지)

## 1. 목적

대학교 복도에 설치되는 디스플레이용 실시간 공지 게시판. 새로고침 없이 InstantDB
를 실시간 구독하여 공지가 추가/수정/삭제될 때 즉시 화면에 반영된다. 교수
사용자는 별도 백엔드 없이 `/admin` 페이지에서 직접 공지를 관리한다.

## 2. 기술 스택

- **프레임워크**: Next.js 16 (App Router) + React 19
- **언어**: TypeScript
- **스타일**: Tailwind CSS v4 (다크 테마 고정)
- **데이터**: [`@instantdb/react`](https://www.instantdb.com) — `useQuery` 실시간
  구독 + `db.transact` 로 프론트에서 직접 mutation
- **애니메이션**: Framer Motion (`layout` + `AnimatePresence`)

## 3. 데이터 모델

InstantDB 의 `notices` 네임스페이스 1개로 단순하게 시작한다.

```ts
// src/lib/instant.ts
const schema = i.schema({
  entities: {
    notices: i.entity({
      title: i.string(),
      content: i.string(),
      professor: i.string(),
      category: i.string(),       // '일반' | '휴강' | '긴급'
      createdAt: i.number().indexed(),
    }),
  },
});
```

- `category` 는 InstantDB 에선 string 으로 두고, 앱 레이어에서 `Category` 리터럴
  타입으로 좁힌다 (`asCategory()` 헬퍼).
- `createdAt` 은 `Date.now()` 의 millisecond. `desc` 정렬을 빠르게 하기 위해
  indexed.

## 4. 페이지

### 4.1 `/` (랜딩)

`/display` 와 `/admin` 으로의 단순 진입 링크. 운영 중에는 디스플레이 단말이 바로
`/display` 를 열어 두므로 거의 사용되지 않음.

### 4.2 `/display`

복도 디스플레이 전용 화면.

**레이아웃 (하이브리드)**
- 상단 sticky 헤더: "Campus Notice" 워드마크 + 실시간 시각·날짜 + 공지 카운트
- **긴급 영역**: `category === '긴급'` 인 공지를 2열 그리드로 핀
- **일반 그리드**: 나머지를 3열(데스크톱) / 2열(태블릿) / 1열(모바일) 그리드
- 공지가 0건이면 안내 빈 상태 표시

**실시간 / 애니메이션**
- `db.useQuery({ notices: { $: { order: { createdAt: 'desc' } } } })`
- 카드는 `motion.article` 의 `layout` prop + `AnimatePresence` 으로 추가·삭제·
  재정렬 시 부드럽게 전환
- 30초마다 `Date.now()` 갱신해 헤더 시계 + "n분 전" 상대시간 자동 갱신

**카테고리 배지**
- 긴급: Red, 휴강: Amber, 일반: Sky Blue. 카드 좌측 1px 컬러 스트라이프 + 우상단
  배지로 이중 표기.

### 4.3 `/admin`

**비밀번호 게이트**
- `NEXT_PUBLIC_ADMIN_PASSWORD` 와 비교 → 통과 시 `sessionStorage.admin_authed=1`
- 탭이 닫히면 재로그인 필요
- 단순 클라이언트 게이트의 한계는 README 보안 메모에 명시

**대시보드 레이아웃**
- 좌측: 최신순 공지 리스트 (수정/삭제 버튼 포함)
- 우측 sticky 카드: 작성/수정 폼 (카테고리 picker, 제목, 작성자, 내용)
- 폼은 동일 컴포넌트가 "새 공지 / 수정" 두 모드를 토글 — 리스트의 "수정" 클릭 시
  폼이 해당 공지로 채워지고, "+ 새 공지로 전환" 으로 초기화

**Mutation**
- 모두 `db.transact(db.tx.notices[id].update(...))` / `.delete()` 사용
- 신규는 `id()` 헬퍼로 uuid 생성
- 삭제는 `window.confirm` 으로 1회 확인

## 5. 폴더 구조

```
src/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx              # 랜딩
│  ├─ display/page.tsx
│  └─ admin/page.tsx
└─ lib/
   ├─ instant.ts            # init + schema + Notice 타입 + asCategory
   └─ categories.ts         # CATEGORY_STYLES + formatRelative/Absolute
```

## 6. 디자인 원칙

- **다크 모노크롬 + 카테고리 액센트** — 배경은 zinc-950, 텍스트는 zinc-100,
  카테고리 컬러로만 컨텐츠 강조. 사이니지 거리에서도 글자가 또렷하게 보이도록
  라인 두께·여백을 후하게.
- **타이포그래피** — 시스템 폰트 스택 + Pretendard 우선 (한글 가독성). 헤딩은
  tracking-tight, 본문은 leading-relaxed.
- **카드** — 둥근 모서리 (rounded-2xl/3xl), `bg-zinc-900/60 backdrop-blur-sm`,
  좌측 컬러 스트라이프로 카테고리 시각화.

## 7. 환경변수

| 키                            | 설명                              |
| ----------------------------- | --------------------------------- |
| `NEXT_PUBLIC_INSTANT_APP_ID`  | InstantDB 대시보드의 App ID       |
| `NEXT_PUBLIC_ADMIN_PASSWORD`  | `/admin` 게이트 비밀번호          |

`.env.example` 참조.

## 8. 추후 확장 아이디어 (현재 스코프 외)

- InstantDB Magic Code 인증으로 교체 → `professor` 자동 채움
- 카테고리별 자동 만료/스케줄 게시
- 자동 carousel 모드 (공지 다수일 때)
- QR 코드 → 학생 휴대폰으로 상세 보기
