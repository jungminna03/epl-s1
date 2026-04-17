# 캠퍼스 공지사항 (epl-s1)

Next.js + InstantDB 기반 실시간 학내 공지 디지털 사이니지.

- **`/display`** — 복도 디스플레이 전용. InstantDB 를 실시간 구독해 새로고침 없이 동기화.
- **`/admin`** — 비밀번호 게이트로 보호된 공지 작성/수정/삭제 대시보드.

## 기술 스택

- Next.js 16 (App Router) · React 19
- TypeScript · Tailwind CSS v4
- [InstantDB](https://www.instantdb.com) (`@instantdb/react`) — 백엔드 없이 프론트에서 실시간 CRUD
- [Framer Motion](https://www.framer.com/motion/) — 카드 enter / exit / layout 애니메이션

## 빠른 시작

1. **InstantDB 앱 만들기** — [instantdb.com/dash](https://www.instantdb.com/dash) 에서 새 앱을 만들고 App ID 를 복사.
2. **환경변수 설정**
   ```bash
   cp .env.example .env.local
   # .env.local 의 NEXT_PUBLIC_INSTANT_APP_ID, NEXT_PUBLIC_ADMIN_PASSWORD 채우기
   ```
3. **개발 서버 실행**
   ```bash
   npm run dev
   ```
4. 브라우저에서 [http://localhost:3000/display](http://localhost:3000/display) 와
   [http://localhost:3000/admin](http://localhost:3000/admin) 을 각각 열어 동작 확인.

## 폴더 구조

```
src/
├─ app/
│  ├─ layout.tsx          # 한국어 / 다크 테마 고정
│  ├─ page.tsx            # 랜딩 (display / admin 진입)
│  ├─ display/page.tsx    # 실시간 디스플레이 (긴급 + 그리드 하이브리드 레이아웃)
│  └─ admin/page.tsx      # 비밀번호 게이트 + 공지 CRUD 대시보드
├─ lib/
│  ├─ instant.ts          # InstantDB init, schema, Notice 타입
│  └─ categories.ts       # 카테고리 스타일/포맷터
└─ globals.css            # Tailwind v4 + 폰트 변수
```

## 데이터 스키마 (`notices`)

| 필드        | 타입               | 설명                              |
| ----------- | ------------------ | --------------------------------- |
| `id`        | uuid               | InstantDB 자동 생성               |
| `title`     | string             | 공지 제목                         |
| `content`   | string             | 본문                              |
| `professor` | string             | 작성자 (교수명)                   |
| `category`  | `'일반'`/`'휴강'`/`'긴급'` | 화면 레이아웃·배지 색상 결정 |
| `createdAt` | number (ms)        | `Date.now()` 타임스탬프, indexed  |

## 디자인 / UX 결정사항

- **다크 테마 고정** — 사이니지 환경(저조도 복도)을 고려.
- **카테고리 컬러** — 긴급=Red, 휴강=Amber, 일반=Sky Blue.
- **하이브리드 레이아웃** — 긴급 공지는 상단에 큰 카드로 핀, 나머지는 3열 그리드.
- **Framer Motion** — `layout` + `AnimatePresence` 로 추가/삭제/재정렬 모두 부드럽게.
- **인증** — 단순 비밀번호 게이트 (`sessionStorage`). 학내망/사이니지 단말 전용 가정.

## 보안 메모

`NEXT_PUBLIC_ADMIN_PASSWORD` 는 클라이언트 번들에 포함됩니다.
공개 인터넷에 노출되는 환경에서는 InstantDB Magic Code 인증 등으로 교체하세요.
