# 자동 업데이트 호스팅 — Vercel Blob → GitHub Releases 이전

**작성일**: 2026-05-18
**작성자**: jungminna03 + Claude
**상태**: 디자인 확정, 구현 plan 대기

## 배경

현재 위젯의 자동 업데이트 인프라는 Vercel Blob 에 의존:

- `widget-config.json` (부트스트랩 설정) — Blob
- `latest.yml` (electron-updater 매니페스트) — Blob
- `*.exe`, `*.exe.blockmap` (인스톨러 자산) — Blob

Vercel Blob 무료 한도(5월분)가 초과되어 store 가 `blocked` 상태. 외부에서 GET 시 `Your store is blocked` 응답. 학교에 설치된 약 **100대** PC 의 자동 업데이트가 사실상 죽어있음 (위젯 자체는 캐시된 설정으로 계속 동작).

## 목표

1. 자동 업데이트 호스팅을 "쭉 무료" 로 유지 가능한 곳으로 이전.
2. 기존 100대 PC 를 가능한 한 **학교 방문 없이 자동 마이그레이션**.
3. 향후 운영에서 트래픽/저장량 한도 걱정 없게.

## 후보 비교 (생략된 옵션 포함)

| 옵션 | 비용 | 자동 업데이터 호환 | 결정 |
|---|---|---|---|
| Google Drive | 무료 | ❌ (100MB 인터스티셜, 다운로드 락) | 탈락 |
| Cloudflare R2 / Backblaze B2 | 카드 등록 필수 | ✅ | "쭉 무료" 원칙 미충족 → 탈락 |
| Vercel 정적 (Blob 아닌) | 무료 | ⚠️ 파일당 100MB 제한, 인스톨러 156MB | 탈락 |
| **GitHub Releases (public)** | **무료, 카드 X, 다운로드 무제한** | **✅** | **채택** |

## 채택 디자인

### 호스팅 구조

`jungminna03/epl-s1` GitHub 저장소를 **public 으로 전환** 후:

| 자원 | URL |
|---|---|
| `widget-config.json` | `https://raw.githubusercontent.com/jungminna03/epl-s1/main/widget-config.json` |
| `latest.yml` | `https://github.com/jungminna03/epl-s1/releases/latest/download/latest.yml` |
| `*.exe` | `https://github.com/jungminna03/epl-s1/releases/latest/download/<filename>` |
| `*.exe.blockmap` | `https://github.com/jungminna03/epl-s1/releases/latest/download/<filename>` |

**왜 widget-config.json 은 raw 파일?**
변경할 일이 자주 있음 (킬스위치, widgetUrl 핫스왑). 매번 release 만들면 부담. raw 는 `git push` 한 번으로 끝. 캐시 ~5분, 폴링 주기 30분과 잘 맞음.

**왜 인스톨러는 release asset?**
electron-updater 의 `generic` provider 가 `<base>/<filename>` 패턴으로 받음. GitHub 의 `releases/latest/download/<filename>` URL 이 정확히 이 패턴을 지원 (302 redirect 로 실제 CDN 가리킴). 코드는 한 줄도 안 바꿔도 됨.

### Provider 결정

`electron-updater` 의 **`generic` provider 유지**. `github` provider 도 가능하지만:
- 코드 변경 0 (URL 만 바뀌면 됨)
- API 호출 X → rate limit 무관 (학교 같은 NAT 뒤에서 여러 PC 가 폴링해도 안전)

### 코드 변경 (4 파일)

| 파일 | 변경 |
|---|---|
| `electron/config.ts` (line 55-56) | `bootstrapUrl` → GitHub raw URL |
| `electron/bootstrap.ts` (line 52) | `DEFAULT_CONFIG.updateFeedUrl` → GitHub releases URL |
| `electron-builder.yml` (publish 섹션) | `url` 만 GitHub releases URL 로 (provider 는 generic 유지) |
| `scripts/release.mjs` | Vercel Blob `put` 블록 → `gh release create / upload --clobber` 호출로 교체 |
| `widget-config.json` | `updateFeedUrl` → GitHub releases URL. main 브랜치에 commit |

`electron/updater.ts` 는 **변경 없음**.

### 듀얼 트랙 운영 (Blob 자연 사망까지)

5/18 ~ 5/31 동안은 두 트랙이 공존:

```
Track A (기존, Blob)               Track B (신규, GitHub)
──────────────────                  ──────────────────────
- 기존 100대 PC 가 가리킴            - 신규 인스톨러가 가리킴
- Blob 에 마지막으로 업로드된 자산    - GitHub Releases 의 자산
- 자동 업데이트 죽어있음 (Blob blocked)
- 위젯 자체는 캐시로 동작            - 자동 업데이트 정상 동작
- 손대지 않고 둠                     - 활발히 운영
```

**Blob 에는 손대지 않음.** 어차피 한도 초과로 read/write 둘 다 막힌 상태. 자연 사망 (6/1 무료 한도 자동 리셋) 까지 둠.

### 100대 PC 마이그레이션 (6/1 트리거)

6/1 에 Vercel Blob 한도가 리셋되면:

1. **Blob 살아남 확인** (`curl` 로 widget-config.json read 시도)
2. 살아있으면 Vercel 대시보드에서 widget-config.json 을 **새 내용** 으로 한 번만 덮어쓰기:
   - `updateFeedUrl`: GitHub releases URL
   - (다른 필드는 그대로)
3. 30분 안에 100대 PC 가 폴링 → 새 설정 받음 → 캐시에 저장
4. 다음 자동 업데이트 폴링에 GitHub release 발견 → 자동 다운로드 → PC 재시작/종료 시 새 인스톨러 설치
5. 새 인스톨러는 `bootstrapUrl` 자체가 GitHub raw URL → Blob 완전 이별

**모든 단계가 자동.** 학교 방문 0회.

### Fallback (6/1 에 Blob 안 살아날 경우)

- 학교 직접 방문 → 새 인스톨러 (Track B) 로 재설치
- 또는 6월 한 달 더 자동 업데이트 죽은 상태로 두고 7월 한도 리셋 재시도

## 신규 PC 설치 (지금 ~ 6/1)

- 5/31 이전에 첫 GitHub Release 생성
- 신규 PC 는 그 release 의 인스톨러로 깔기 (학교에 새로 배치되는 PC)
- 이들은 처음부터 Track B 임

## 위험 / 제약

| 위험 | 완화책 |
|---|---|
| 6/1 한도 리셋 후에도 Blob 영구 잠김 | 학교 방문 + 수동 재설치 (100대) |
| GitHub repo public 전환 → 코드 노출 | 코드 자체는 푸시 안 함. main 브랜치엔 `widget-config.json` + `README.md` 정도만 두고, 본체 저장소는 Synology git (`git.rehomik.synology.me`) 그대로 유지. GitHub repo 는 사실상 "release/config 호스팅 전용" |
| `releases/latest/download` URL 의 302 redirect 가 electron-updater 와 호환 안 됨 | electron-updater 의 net 모듈은 redirect 따라감. 실 세계 다른 Electron 앱에서 검증된 패턴 |
| GitHub Actions rate limit | API 호출 아닌 정적 asset 다운로드 → rate limit 무관 |

## 비-목표

- Vercel 웹 호스팅 (`epl-s1.vercel.app/widget`, `/display`) 은 계속 사용. 이건 정적 페이지 호스팅이라 Blob 한도와 무관.
- GitHub 으로 코드 자체 이전은 안 함. `git.rehomik.synology.me` (Synology Git) 가 본진.

## 관련 파일

- `electron/config.ts`
- `electron/bootstrap.ts`
- `electron/updater.ts` (참조만, 변경 없음)
- `electron-builder.yml`
- `scripts/release.mjs`
- `widget-config.json`

## 다음 단계

이 spec 승인 후 `writing-plans` 스킬로 단계별 구현 plan 작성.
