# 디코봇 채널 공지 연동 — 흐름 분석 및 준비물

- 작성일: 2026-09-01
- 담당: 나정민
- 목적: 시스템(admin)에 입력된 공지를 Discord 채널로도 자동 전파

---

## 1. 현재 공지 입력 흐름 (as-is)

```
[관리자] /admin (브라우저)
   └─ handleSubmit()                        src/app/admin/page.tsx:254
        ├─ requestMeta(content)             → POST /api/summarize → Ollama (제목/요약 생성)
        └─ db.transact(db.tx.notices[id].update({...}))   ← 클라이언트에서 InstantDB 로 직접 write
                │
                ├─ 웹 디스플레이 (/display)   실시간 구독
                └─ Electron 위젯 (/widget)    실시간 구독
```

**핵심 제약: 쓰기 경로가 100% 클라이언트다.**
`db.transact` 는 관리자 브라우저에서 InstantDB 로 직접 나간다. 우리 서버(Next.js API Route)는
"새 공지가 생겼다"는 사실을 알 수 있는 지점이 지금 **하나도 없다**.
따라서 Discord 연동의 첫 설계 결정은 *"서버가 공지 생성을 어디서 알아채게 할 것인가"* 다.

`/api/summarize` 는 이미 "서버 전용 env(OLLAMA_API_KEY) 를 쓰는 API Route" 선례라,
같은 패턴으로 `/api/discord/*` 를 붙이면 구조적으로 이질감이 없다.

---

## 2. 트리거 방식 3안

### A. 저장 직후 클라이언트가 발송 API 호출 (fan-out at write) — **추천**

```
handleSubmit()
  ├─ db.transact(...)                       ← 기존 그대로 (먼저 성공)
  └─ fetch("/api/discord/announce", {noticeId, title, summary, ...})   ← 추가, 실패해도 무시
         └─ [서버] Discord Webhook POST
```

- 장점: 추가 인프라 0, 새 의존성 0(`fetch` 로 충분), 즉시 발송, 수정/삭제도 같은 자리에서 처리.
- 단점: admin UI 를 거치지 않는 write(직접 DB 조작 등)는 누락. 라우트가 사실상 공개라 위조 가능(§6).
- `requestMeta` 가 이미 "실패해도 throw 안 하고 저장 흐름 안 막음" 패턴이라 그대로 재사용 가능.

### B. Vercel Cron 폴링

5~10분마다 Cron → InstantDB 를 서버에서 조회 → `discordMessageId == null` 인 공지를 발송.

- 장점: 쓰기 경로와 무관하게 100% 커버. 재시도가 자연스럽게 됨. 예약 발송(startDate 미래) 도 이걸로만 가능.
- 단점: **`@instantdb/admin` 패키지 추가 필요 → CLAUDE.md 사전 승인 룰 대상**. 최대 N분 지연.

### C. 상시 구동 디스코드 봇 프로세스

별도 호스팅(Railway/Fly 등)에서 봇을 띄우고 InstantDB 실시간 구독 + 슬래시 커맨드.

- 장점: 양방향(디스코드에서 공지 등록 등) 가능.
- 단점: Vercel 밖 상시 호스팅 필요. 현재 요구사항엔 오버킬.

**결론: A 로 시작. 멱등성 필드(§5)를 처음부터 넣어두면 나중에 B 를 그 위에 얹어도 중복 발송이 안 난다.**

---

## 3. 발송 채널: Bot (결정됨 — 2026-09-01)

**Bot 방식으로 확정.** 단, "봇 = 상시 호스팅 필요" 는 오해다. Discord 봇이 Discord 와
연결되는 방식은 두 가지고, 이게 Vercel 가능 여부를 가른다.

### ① 아웃바운드 — 우리가 Discord 를 호출 (공지 발송이 여기 해당)
```
POST https://discord.com/api/v10/channels/{channelId}/messages
Authorization: Bot <DISCORD_BOT_TOKEN>
{ "embeds": [ ... ] }
```
그냥 `fetch` 한 방. 상시 프로세스 불필요. **Vercel API Route 로 100% 가능.**

### ② 인바운드 — Discord 가 우리를 호출 (슬래시 커맨드 등)

| 방식 | 동작 | Vercel |
| --- | --- | --- |
| **Gateway** (WebSocket) | 봇이 24시간 WS 를 붙들고 이벤트 수신 | ❌ 상시 프로세스 필요 |
| **Interactions Endpoint** (HTTP) | Discord 가 우리 URL 로 POST | ✅ 그냥 API Route |

Gateway 가 실제로 필요한 경우: 채널 전체 메시지 실시간 수신, 리액션 감지, 음성 채널,
멤버 입장 감지. **현재 요구사항에는 하나도 없다.** → Interactions Endpoint 로 간다.

### Interactions Endpoint 구현 시 필수 사항
1. **Ed25519 서명 검증 필수** — `X-Signature-Ed25519` / `X-Signature-Timestamp` 헤더.
   검증 실패 시 401 을 돌려주지 않으면 Discord 가 엔드포인트 등록 자체를 거부한다.
   Node 내장 `crypto` 의 WebCrypto Ed25519 로 처리 → **새 패키지 불필요**.
2. **PING(type:1) → PONG(type:1)** 응답. 등록 시 Discord 가 헬스체크를 쏜다.
3. **3초 내 응답.** 초과 시 `type:5`(deferred) 로 먼저 답하고 follow-up webhook 으로 결과 전송.
   Ollama 요약(최대 15초)이 끼는 커맨드는 이 패턴 필수.
4. **body 를 raw text 로 읽어야 서명 검증 가능** — `req.json()` 을 먼저 호출하면 안 된다.
5. **커맨드 등록은 1회성** — `PUT /applications/{appId}/commands`, `scripts/` 에 스크립트로.

### Webhook 대비 이점
- 채널 URL 고정이 아니라 **채널 ID** 로 지정 → env 가 URL 5개 대신 ID 5개로 단순
- **디스코드에서 공지 등록** 가능 (`/공지등록` → 모달 → InstantDB write). 양방향
- 역할/권한 관리가 정식으로 동작

## 4. 카테고리 → 채널 매핑

**결정 (2026-09-09)**: 채널은 **5개** — 1·2·3·4학년 + 전체. `'전체'` 는 학년의 합집합이 아니라
**대등한 5번째 대상**이고, 학년과 **중복 선택 가능**하다.

`notices.category` 는 CATEGORIES(`1학년 | 2학년 | 3학년 | 4학년 | 전체`)의 쉼표 구분 문자열.

```
'전체'       → 전체 채널에만
'1학년'      → 1학년 채널에만        (전체 채널로 미러되지 않는다)
'1학년,전체' → 1학년 채널 + 전체 채널
```

env: `DISCORD_CHANNEL_Y1` ~ `DISCORD_CHANNEL_Y4`, `DISCORD_CHANNEL_ALL` (채널 ID).
설정 안 된 채널은 조용히 skip (부분 설정으로도 동작하게).
같은 채널 ID 가 여러 대상에 걸리면 `resolveTargets` 의 Map dedupe 로 1회만 발송된다.

폐기된 초안: `DISCORD_CHANNEL_ALL` 을 "모든 공지가 추가로 가는 미러 채널" 로 두는 안.
1학년 공지가 2곳에 중복으로 뜨고, 어드민의 "전체" 버튼(4학년 일괄 선택)과 의미가 어긋나 폐기.

---

## 5. 메시지 포맷 & 멱등성

### Embed 페이로드 (안)
- `title` = notice.title
- `description` = notice.summary ?? content 앞 200자
- `url` = notice.link (있을 때만)
- `fields` = 게시 기간(startDate~endDate), 담당 교수(professor)
- `color` = 학년별 컬러
- `timestamp` = createdAt

### 스키마 확장 (instant.schema.ts)
```ts
discordMessageId: i.string().optional(),   // 채널 여러 개면 JSON 문자열로 {webhookKey: messageId}
discordPostedAt: i.number().optional(),
```
→ `npx instant-cli push schema` 필요.

- **신규**: POST → 응답의 message id 저장 → 재발송 방지(멱등성)
- **수정**: `discordMessageId` 있으면 `PATCH /channels/{ch}/messages/{id}` 로 embed 갱신
- **삭제**: `DELETE /channels/{ch}/messages/{id}` (handleDelete 에서)
- 위 셋 다 실패해도 공지 저장/삭제 흐름은 절대 막지 않는다.

### 예약 발송
`startDate` 가 미래인 공지를 그 날짜에 맞춰 보내려면 A안만으론 불가 → B(Cron) 필요.
1차 범위에서는 **저장 즉시 발송**으로 두는 걸 권장.

### Rate limit
Bot REST 는 채널당 초당 ~5회. 429 응답의 `retry_after` 를 존중해 1회 재시도만.

---

## 6. 미해결 이슈 (결정 필요)

**`/api/discord/announce` 의 인증.**
A안은 브라우저가 라우트를 부르는 구조라, 시크릿을 클라이언트에 둘 수 없다
(`NEXT_PUBLIC_*` 로 노출하면 시크릿이 아님). 즉 라우트가 사실상 공개 엔드포인트가 되어
누구나 채널에 임의 메시지를 밀어넣을 수 있다. 선택지:

1. **감수한다** — 현재 `/admin` 자체가 `NEXT_PUBLIC_ADMIN_PASSWORD` 클라이언트 게이트라 보안 수준이 이미 그 정도.
2. **noticeId 만 받고 서버가 DB 재조회** — 존재하는 공지만 발송 가능해져 위조 페이로드 차단.
   단 `@instantdb/admin` 필요(사전 승인 대상).
3. **B안(Cron)으로 전환** — 클라이언트가 트리거하지 않으므로 문제 자체가 소멸. 역시 admin SDK 필요.

→ 제대로 하려면 2 or 3, 즉 **`@instantdb/admin` 도입 승인**이 사실상의 갈림길.

---

## 7. 준비물 체크리스트

### Discord 쪽 (사람이 해야 하는 일)
- [ ] 대상 서버(길드) 관리자 권한 확보
- [ ] Developer Portal 에서 Application 생성 → **Application ID**, **Public Key** 확보
- [ ] Bot 탭에서 **Bot Token** 발급 (한 번만 보여줌, 유출 시 재발급)
- [ ] OAuth2 URL Generator → 스코프 `bot` + `applications.commands`, 권한 `Send Messages` /
      `Embed Links` / `Manage Messages`(수정·삭제용) → 초대 URL 로 서버에 봇 초대
- [ ] 공지 채널 확정 후 각 채널 **ID** 복사 (개발자 모드 켜고 채널 우클릭 → ID 복사)
- [ ] 봇 역할에 해당 채널 쓰기 권한 부여
- [ ] (역할 멘션 쓸 경우) 대상 역할 ID

### 환경변수 (전부 서버 전용, `NEXT_PUBLIC_` 접두사 금지)
- [ ] `DISCORD_BOT_TOKEN`
- [ ] `DISCORD_APP_ID`
- [ ] `DISCORD_PUBLIC_KEY` (Interactions 서명 검증용)
- [ ] `DISCORD_CHANNEL_ALL`, `DISCORD_CHANNEL_Y1`~`Y4`
- [ ] `.env.local` + `.env.example` 갱신, Vercel Production 에도 `vercel env add`

### 코드
- [ ] `instant.schema.ts` — `discordMessageId` / `discordPostedAt` 추가 후 `npx instant-cli push schema`
- [ ] `src/lib/discord.ts` — 채널 매핑, embed 빌더, REST 헬퍼 (ai-summary.ts 와 같은 결)
- [ ] `src/app/api/discord/announce/route.ts` — 아웃바운드 (POST/PATCH/DELETE)
- [ ] `src/app/api/discord/interactions/route.ts` — 인바운드. 서명 검증 + PING/PONG.
      (슬래시 커맨드를 붙일 때만 필요)
- [ ] `scripts/register-discord-commands.mjs` — 커맨드 1회 등록
- [ ] `src/app/admin/page.tsx` — `handleSubmit` / `handleDelete` 뒤 fire-and-forget 호출
- [ ] 새 npm 의존성: **없음** (fetch + Node 내장 crypto 로 충분)

### 배포
- [ ] `src/**` 만 바뀌므로 **Vercel 만** 배포 (`npm run build` → `vercel --prod`)
- [ ] `electron/**` / `package.json` version 무관 → GitHub Release 불필요
- [ ] 배포 후 Developer Portal 의 **Interactions Endpoint URL** 에
      `https://epl-s1.vercel.app/api/discord/interactions` 등록 (라우트 먼저 떠 있어야 검증 통과)

## 8. 다음 단계

1. ~~§6 인증 방침 + 채널 구성 + 예약 발송 필요 여부 결정~~ — 완료. 채널은 학년 4 + 전체 1 = 5개(§4),
   예약은 기능 자체 폐기, 인증은 `/admin` 게이트와 동수준으로 감수 (plans §B-4)
   (§3 발송 방식은 Bot + Interactions Endpoint 로 확정)
2. 결정 반영해서 구현 계획(`docs/superpowers/plans/`) 작성
3. 구현 → Vercel 배포
