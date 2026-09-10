# 디코봇 공지 연동 — 실행 타임라인

- 작성일: 2026-09-01
- 설계 문서: `docs/superpowers/specs/2026-09-01-discord-notice-relay-design.md`
- 범위: **형태 1** (클라 저장 → 서버 라우트가 Discord 발송). 아웃바운드만. 슬래시 커맨드 없음.
- 총 소요: 약 1시간 (사용자 10분 + 구현 40분 + 배포 10분)
- **2026-09-03 보완**: 지도 회의 반영 — 학년 선택 필수화 + 학년별 채널 라우팅 + 현 시스템 수정 범위 판단 (§보완 참조)

---

## 보완 (2026-09-03 [지도] 반영)

### B-1. 학년(1~4) 선택 필수화

- as-is: `notices.category` 는 `''`(미선택) 허용. CategoryPicker 는 다중 토글, 아무것도 안 골라도 저장 가능.
- to-be: **최소 1개 학년 필수**. 디스코드는 학년별 채널로 라우팅하므로 학년이 비면 보낼 곳이 없다.
  - 다중 선택은 유지한다 (데이터 모델이 이미 `"1학년,3학년"` 쉼표 구분). 여러 학년을 고르면 각 학년 채널에 모두 발송.
  - `handleSubmit` 에서 `parseCategories(form.category).length === 0` 이면 저장 중단 + 제출 버튼 disabled + 안내 문구.
  - **기존 `''` 공지는 건드리지 않는다.** display/widget 은 이미 `parseCategories` 로 빈 값을 처리하고 있어 표시엔 영향 없음.
    단 수정 모드로 열어 저장할 때는 학년을 골라야 통과된다 (자연스러운 백필).
  - 스키마 변경 없음 (`category: i.string()` 그대로).

### B-2. 학년별 채널 라우팅

**2026-09-09 정정**: 채널은 5개(1~4학년 + 전체)이고, **"전체" 는 대등한 5번째 대상**이다.
`CATEGORIES` 에 `"전체"` 를 추가해 학년과 동일하게 취급한다 — 중복 선택 가능, 전체를 고른 공지만
ALL 채널로 간다. 아래 원문의 "모든 공지가 여기에도 감"(미러) 정의는 폐기됨.

```
DISCORD_CHANNEL_Y1 ~ DISCORD_CHANNEL_Y4   학년 → 채널 ID (각각 선택 설정)
DISCORD_CHANNEL_ALL                      "전체" 대상 → 채널 ID
```
- 매핑 규칙: `parseCategories(category)` 의 각 대상 → 해당 env. 미설정 채널은 조용히 skip.
- 같은 채널 ID 가 여러 학년에 걸리면 (예: 1·2학년 통합 채널) **1회만** 발송 (Set 으로 dedupe).
- 발송 결과는 채널별로 `{ channelId, ok, messageId? }` 배열로 돌려준다 — 이후 수정/삭제 동기화 시 저장할 형태.
- 이로써 Phase 5-1 (학년별 채널 분리) 은 1차 범위로 흡수됨.

### B-3. 현 시스템 수정 범위 판단

| 후보 | 판단 |
| --- | --- |
| 관리자 페이지 클라이언트에 봇 토큰을 두고 직접 Discord 호출 | ❌ `NEXT_PUBLIC_` 로 번들에 박히면 토큰 유출 = 봇 권한 전체 유출 |
| **Next API Route(`/api/discord/announce`) 가 토큰 보관, 클라는 라우트만 호출** | ✅ 채택. `/api/summarize` + `OLLAMA_API_KEY` 와 완전히 같은 결. 새 의존성 0 |
| 별도 봇 서버 + InstantDB 구독 | ❌ 상시 호스팅 필요, 현 요구사항엔 과함 (Phase 5 이후) |
| Webhook | ❌ 채널 1개 고정. 학년별 라우팅과 충돌 |

- **트리거 시점**: `handleSubmit` 에서 `requestMeta`(AI 제목·요약) → `db.transact` 성공 **이후**.
  즉 디스코드에 나가는 제목/요약은 시스템에 저장된 최종값과 동일하다. ("AI요약·제목설정 이후 연동")
- **범위**: 신규 등록 + **수정/삭제 동기화까지** 1차에 포함 (2026-09-03 사용자 요청 — "공지 수정하면 디코에서도 수정").
  스키마에 `discordMessages: json` ({channelId: messageId}) 추가. Phase 5-2 흡수.
- **실패 정책**: 발송 실패는 삼킨다. 공지 저장은 이미 끝났고 UI 를 막지 않는다. (`requestMeta` 와 동일)
- 수정 파일: `src/lib/discord.ts`(신규), `src/app/api/discord/announce/route.ts`(신규),
  `src/app/admin/page.tsx`(학년 필수 + 동기화 호출), `instant.schema.ts`, `.env.example`. `electron/**` 무관 → Vercel 만 배포.
- 브랜치: `feat/discord-notice-relay`

### B-4. 사용 방식 디테일 (2026-09-03 정리)

**운영 원칙 (2026-09-03)**: 디코 전송은 **풀오토**. 관리자는 공지 내용만 입력하고 디스코드 관련 선택지는 UI 에 두지 않는다.
채널·멘션 같은 라우팅 설정은 전부 env 로만 결정한다.

**구현됨** — 토큰 + 채널 ID (+ 역할 ID) 만 넣으면 아래가 전부 동작한다.

| 상황 | 동작 |
| --- | --- |
| 신규 등록 | AI 제목·요약 → DB 저장 → 선택 학년 채널(+ALL)에 embed 게시 → 메시지 ID 를 공지에 저장 |
| 내용/제목/기간/링크 수정 | 저장된 메시지를 `PATCH` 로 갱신. 새 글이 안 올라가고 같은 자리에서 바뀜 |
| 학년 변경 (1학년 → 2학년) | 1학년 채널 메시지 삭제 + 2학년 채널에 새로 게시 |
| 공지 삭제 | 모든 채널의 메시지 `DELETE` |
| 요약 백필/재생성 버튼 | 디코에 올라간 공지면 갱신된 제목·요약을 그쪽에도 반영 |
| 디코에서 누가 메시지를 수동 삭제 | 다음 수정 시 404 → 새로 게시하고 매핑 갱신 |
| 어떤 채널 env 가 비어 있음 | 그 대상은 조용히 skip. 나머지는 정상 |
| 대상을 "전체" 로 지정 | 전체 채널에만 1회 게시. 학년 채널로는 안 감 |
| "1학년,전체" 처럼 혼합 지정 | 1학년 채널 + 전체 채널 두 곳에 게시 |
| 토큰 없음 | 라우트 503 → 클라가 무시. 공지 저장/수정/삭제 전부 정상 |
| 발송 일부 실패 | 성공한 채널만 매핑에 반영. 실패 채널은 다음 저장 때 재시도됨 |
| 429 rate limit | `retry_after` 대기 후 1회 재시도 |
| 멘션 | `DISCORD_MENTION_Y1~Y4 / ALL` (역할 ID · everyone · here). 채널별로 붙음. 학년 채널마다 학년 역할이 따로 있으므로 그 역할 ID 사용 (2026-09-03 결정). 수정 시엔 Discord 가 재알림 안 함 |

**메시지 형식**: 제목(링크 있으면 클릭 가능) / 요약 굵게 + 본문 전체(2000자 cap) / 게시 기간(서울 기준, 자동 종료 표기) /
담당 / 바로가기 / footer 에 학년 / 색상은 첫 학년 컬러(위젯과 동일 hex). 봇 권한은 `Send Messages` + `Embed Links` 로 충분 —
자기 메시지 수정·삭제엔 `Manage Messages` 불필요.

**UX 결정 (2026-09-03 흐름 점검)**

- ~~학년 피커에 **전체** 토글 추가 (4개 전부 선택/해제).~~ — 2026-09-09 폐기.
  "전체" 는 자기 채널을 가진 대등한 대상이라 일괄 선택 단축키를 겸할 수 없다. 나머지와 동일한 토글로 바꿈
  (일괄 선택 단축키는 사라짐).
- 등록/수정 진행 오버레이를 **AI 요약 → 저장 → 디스코드 전송** 3단계 스텝으로 교체. 디코 전송 구간에도 떠 있어
  탭을 닫아 전송이 유실되는 걸 막는다. 버튼 라벨도 같은 단계 문구.
- 삭제 confirm 에 "디스코드 글도 함께 삭제됩니다" 명시 (디코에 올라간 공지일 때만).
- **수정은 조용히** — 메시지만 갱신, 재알림 없음. 새 글로 다시 올리지 않는다.
- 제목 비움 = AI 자동 생성 의도로 간주. 미리보기 단계 두지 않음.

**예약·종료 정책 (2026-09-03 최종)**

- **예약 기능 폐기.** 공지는 등록 즉시 클라이언트와 디스코드에 함께 공개된다. 어드민 폼에서 시작일 입력을 제거하고 종료일만 받는다
  (새 공지 startDate = 오늘, 수정 시 기존 값 유지). 데이터 모델의 `startDate` 는 호환용으로 남긴다.
- 검토했다가 접은 안: Vercel Cron + InstantDB admin HTTP API 로 시작일 자정에 발송. 동작은 했지만 `INSTANT_APP_ADMIN_TOKEN` 과
  `CRON_SECRET` 두 값이 추가로 필요해져 "토큰 + 채널 ID 만 넣으면 됨" 원칙과 어긋나 폐기. 디스플레이 클라이언트 트리거 안은
  중복 게시 위험으로 채택 안 함.
- **종료일 경과**: 아무것도 안 함. 디코 글은 그대로 남는다.
- **삭제**: 디코 글도 삭제.
- **메시지 날짜**: embed 본문 맨 윗줄에 `📅 YYYY.MM.DD ~ YYYY.MM.DD` 로 게시 기간을 항상 표시.

**아직 결정 안 된 디테일** (사용하면서 정할 것):

1. ~~예약 공지~~ — 결정·구현됨 (2026-09-03, 아래 "예약·종료 정책"). 원문: `startDate` 가 미래여도 지금은 저장 즉시 올라간다 (게시 기간 필드로 "언제부터" 는 보임).
   그 날짜에 맞춰 올리려면 Vercel Cron + admin SDK (Phase 5-4).
2. ~~종료된 공지~~ — 결정: 그냥 둔다. 디코 메시지 삭제/표시 변경 없음. 원문: 게시 기간이 끝나도 디코 메시지는 남는다. 삭제할지 / "종료" 표시로 바꿀지 / 그냥 둘지.
3. ~~멘션~~ — 결정·구현됨 (위 표). 
4. ~~관리자 UI 피드백~~ — 불필요로 결정 (2026-09-03). 디코에 뜨는 걸로 확인하면 되므로 배지/토스트 안 둠.
5. **저장 직후 탭 닫기** — 발송 요청 유실 가능 (형태 1 한계). 실사용에서 문제 되면 형태 2 (Phase 5-3).
6. **라우트 노출** — `/api/discord/announce` 는 인증이 없다 (spec §6). `/admin` 게이트와 같은 수준으로 감수 중.
7. **스키마 push** — `npx instant-cli push schema` 권장. InstantDB 기본 설정은 신규 attr 를 자동 생성하므로
   push 없이도 동작하지만, 대시보드에 타입이 보이게 하려면 한 번 밀어두는 게 좋다.

---

## Phase 0 — Discord 준비 (사용자, ~10분)

이 단계는 사람이 직접 해야 한다. 끝나면 값 2개(토큰, 채널 ID)가 손에 남는다.

### 0-1. Application + Bot 생성 (3분)
1. https://discord.com/developers/applications → **New Application** → 이름 입력(예: `EPL 공지봇`)
2. 좌측 **Bot** 탭 → **Reset Token** → 토큰 복사
   - ⚠️ 이 화면을 벗어나면 다시 못 본다. 바로 안전한 곳에 붙여넣을 것
   - ⚠️ 이 토큰이 유출되면 봇 권한 전체가 털린다. 절대 커밋/채팅에 붙여넣지 말 것
3. 같은 화면의 **Public Bot** 은 꺼도 된다 (우리 서버에만 쓸 거면)

### 0-2. 서버에 봇 초대 (3분)
1. 좌측 **OAuth2** → **URL Generator**
2. SCOPES: `bot` 체크
3. BOT PERMISSIONS: `Send Messages`, `Embed Links` 체크. 역할 멘션을 쓰려면 `Mention Everyone` 도 체크
   (역할이 "누구나 멘션 가능" 으로 설정돼 있지 않으면 이 권한 없이는 알림이 안 울린다).
   자기 메시지 수정·삭제엔 `Manage Messages` 불필요.
4. 하단 생성된 URL 복사 → 브라우저로 접속 → 대상 서버 선택 → 승인
5. Discord 서버 멤버 목록에 봇이 보이면 성공

### 0-3. 채널 ID 확보 (2분)
1. Discord 앱 → 사용자 설정 → **고급** → **개발자 모드** ON
2. 공지 보낼 채널 우클릭 → **채널 ID 복사**
   학년 역할도 멘션할 거면 서버 설정 → 역할 → 해당 역할 우클릭 → **ID 복사** (`DISCORD_MENTION_Y*` 에 넣음)
3. 비공개 채널이면 그 채널 권한 설정에서 봇 역할에 쓰기 권한 명시 부여
   (공개 채널이면 `@everyone` 기본 권한으로 그냥 됨)

### 0-4. 값 전달 (2분)
`.env.local` 에 아래 2줄 추가. `.env.local` 은 이미 gitignore 대상이라 커밋 안 된다.
```
DISCORD_BOT_TOKEN=<0-1 에서 받은 토큰>
DISCORD_CHANNEL_Y1=<1학년 채널 ID>
DISCORD_CHANNEL_Y2=<2학년 채널 ID>
DISCORD_CHANNEL_Y3=<3학년 채널 ID>
DISCORD_CHANNEL_Y4=<4학년 채널 ID>
DISCORD_CHANNEL_ALL=<전체 채널 ID>
```

**✅ Phase 0 완료 조건**: 봇이 서버 멤버 목록에 보이고, `.env.local` 에 두 값이 들어감

---

## Phase 1 — 서버 발송 경로 구현 (~25분)

### 1-1. `src/lib/discord.ts` (신규)
- 카테고리 → 채널 ID 매핑 (학년별 `DISCORD_CHANNEL_Y1~Y4` + 선택 `DISCORD_CHANNEL_ALL`, dedupe — §B-2)
- `buildNoticeEmbed(notice)` — title / description(summary ?? content 앞 200자) / url(link) /
  fields(게시 기간, 교수) / color / timestamp
- `postMessage(channelId, embed)` — `POST /api/v10/channels/{id}/messages`, `Authorization: Bot ...`
- 429 응답 시 `retry_after` 만큼 대기 후 1회 재시도
- `ai-summary.ts` 와 같은 결로: 실패해도 throw 안 하고 결과만 돌려준다

### 1-2. `src/app/api/discord/announce/route.ts` (신규)
- `POST` — body 검증 → embed 빌드 → 발송 → `{ ok, messageId }` 반환
- `DISCORD_BOT_TOKEN` 없으면 `503 { error: "discord_disabled" }`
  (env 미설정 환경에서도 앱이 안 죽게 — `/api/summarize` 의 `ai_disabled` 와 동일 패턴)
- 서버 전용 env 만 읽는다. `NEXT_PUBLIC_` 절대 금지

**✅ Phase 1 완료 조건**: `npx tsc --noEmit` 통과

---

## Phase 2 — admin 연결 (~10분)

### 2-1. `src/app/admin/page.tsx`
`handleSubmit` 의 `db.transact(...)` **성공 직후**에 fire-and-forget 호출 추가.
- 신규는 게시, 수정은 저장된 메시지 갱신, 삭제는 메시지 삭제 (§B-4)
- `await` 하되 실패는 삼킨다 — 발송이 실패해도 공지 저장은 이미 끝났고, UI 를 막지 않는다
- `requestMeta` 가 이미 쓰는 "실패해도 throw 안 함" 패턴 그대로

**✅ Phase 2 완료 조건**: `npm run build` 통과

---

## Phase 3 — 로컬 검증 (~10분)

```bash
npm run dev
```
1. `/admin` 접속 → 로그인 → 테스트 공지 등록
2. Discord 채널에 embed 가 뜨는지 확인
3. 확인할 것:
   - [ ] 제목 / 요약이 올바르게 들어갔나
   - [ ] `link` 있는 공지는 클릭 가능한가
   - [ ] 게시 기간 필드가 맞나
   - [ ] `DISCORD_BOT_TOKEN` 을 잠깐 지웠을 때 **공지 저장은 정상 동작**하는가 (발송만 조용히 skip)
4. 브라우저 devtools → Network / Sources 에서 **토큰 문자열이 안 보이는지** 확인

**✅ Phase 3 완료 조건**: 채널에 메시지 도착 + 토큰 미노출 확인

---

## Phase 4 — 배포 (~10분)

```bash
# 1. Vercel Production 에 env 등록
vercel env add DISCORD_BOT_TOKEN production
vercel env add DISCORD_CHANNEL_Y1 production   # Y2~Y4 도 동일
vercel env add DISCORD_CHANNEL_ALL production   # 선택
vercel env add DISCORD_MENTION_Y1 production    # 선택, Y2~Y4/ALL 동일

# 2. 빌드 확인
npm run build

# 3. 배포
vercel --prod
```

- `src/**` 만 바뀌므로 **Vercel 만** 배포하면 된다
- `electron/**` / `package.json` version 무관 → GitHub Release / 위젯 버전 올릴 필요 없음
- 배포 후 프로덕션 `/admin` 에서 실제 공지 1건 등록해 최종 확인

**✅ Phase 4 완료 조건**: 프로덕션에서 등록한 공지가 Discord 채널에 뜸

---

## Phase 5 — 이후 확장 (선택, 별도 세션)

우선순위 순:

1. ~~학년별 채널 분리~~ — 2026-09-03 보완으로 1차 범위에 흡수됨 (§B-2)
2. ~~수정 / 삭제 동기화~~ — 2026-09-03 1차 범위에 흡수됨 (§B-4)
3. **형태 2 이관** — 저장 자체를 `POST /api/notices` 로 서버에 옮겨 누락·위조를 구조적으로 차단.
   `@instantdb/admin` 사전 승인 필요 (~2시간)
4. ~~예약 발송~~ — 2026-09-03 기능 자체 폐기 (§B-4)
5. **슬래시 커맨드** — `/공지등록` 등. Interactions Endpoint + Ed25519 서명 검증 필요.
   추가 값: `DISCORD_APP_ID`, `DISCORD_PUBLIC_KEY`

---

## 알려진 한계 (형태 1 기준)

- admin UI 를 거치지 않은 DB write 는 Discord 로 안 나간다
- 저장 직후 탭을 닫으면 발송 요청이 유실될 수 있다
- `/api/discord/announce` 는 시크릿을 걸 수 없어 사실상 공개 엔드포인트다.
  현재 `/admin` 이 `NEXT_PUBLIC_ADMIN_PASSWORD` 클라이언트 게이트인 것과 같은 수준의 노출.
  → 위 셋 다 **Phase 5-3 (형태 2)** 로 한 번에 해소된다
