# electron-resources/

electron-builder 의 `buildResources` 폴더. 패키지 시 NSIS 인스톨러·트레이 아이콘 등으로 쓰이는 정적 리소스가 들어간다.

## 필요한 파일

- `icon.ico` — 앱/트레이/인스톨러 아이콘. **256×256 권장**, ICO 멀티 사이즈(256/128/64/48/32/16) 포함이 가장 안전. 누락 시 빌드는 되지만 트레이가 빈 아이콘으로 뜨고 NSIS는 기본 아이콘을 사용한다.

ICO를 만들 도구가 없으면:

```powershell
# 예: 1024px PNG 한 장에서 ICO 생성 (ImageMagick)
magick convert logo-1024.png -define icon:auto-resize=256,128,64,48,32,16 electron-resources/icon.ico
```
