# EPL 위젯 — 릴리즈 호스팅

이 저장소는 EPL 캠퍼스 공지사항 데스크톱 위젯의 **자동 업데이트 배포** 전용입니다.
본체 코드는 별도 저장소 (Synology Git) 에서 관리됩니다.

## 호스팅하는 것

- `widget-config.json` (main 브랜치 raw 파일) — 위젯이 부팅 시 fetch 하는 런타임 설정.
  변경: `git push` 한 번이면 5분 안에 학교 PC 들이 받음.
- Releases — 인스톨러 / latest.yml / blockmap. electron-updater 가 30분 주기로 폴링.

## 자동 업데이트 URL

- 매니페스트: https://github.com/jungminna03/epl-s1/releases/latest/download/latest.yml
- 부트스트랩: https://raw.githubusercontent.com/jungminna03/epl-s1/main/widget-config.json
