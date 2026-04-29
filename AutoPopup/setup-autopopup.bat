@echo off
chcp 65001 >nul
setlocal

:: ============================================================
::  EPL 공지사항 자동 시작 설치 스크립트
::
::  하는 일:
::    1. Chrome 설치 경로를 찾는다
::    2. 시작 프로그램 폴더에 단축키 생성
::       → 부팅 시 https://epl-s1.vercel.app/display 자동 오픈
::
::  사용법:
::    이 파일을 USB로 대상 PC에 복사한 뒤 더블클릭하세요.
::    한 번만 실행하면 그 PC는 이후 부팅 때마다 사이트를 띄웁니다.
::
::  제거 방법:
::    Win+R → shell:startup → "EPL 공지사항.lnk" 삭제
:: ============================================================

set "URL=https://epl-s1.vercel.app/display"
set "LNK_NAME=EPL 공지사항.lnk"

echo.
echo === EPL 공지사항 자동 시작 설치 ===
echo.

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
    echo [ERROR] Chrome이 설치되어 있지 않습니다.
    echo         https://www.google.com/chrome 에서 먼저 설치해주세요.
    echo.
    pause
    exit /b 1
)

echo [OK] Chrome 발견: %CHROME%

powershell -NoProfile -ExecutionPolicy Bypass -Command "$startup = [Environment]::GetFolderPath('Startup'); $lnk = Join-Path $startup '%LNK_NAME%'; if (Test-Path -LiteralPath $lnk) { Write-Host '[INFO] 기존 등록을 덮어쓰는 중...' }; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut($lnk); $s.TargetPath = '%CHROME%'; $s.Arguments = '--start-maximized %URL%'; $s.WindowStyle = 1; $s.Save(); Write-Host ('[OK] 자동 시작 등록 완료: ' + $lnk)"

if errorlevel 1 (
    echo.
    echo [ERROR] 자동 시작 등록 실패.
    pause
    exit /b 2
)

echo.
echo 부팅 시 %URL% 가 자동으로 열립니다.
echo.
echo --------------- 제거 방법 ---------------
echo   1. Win+R 키를 누른다
echo   2. shell:startup 입력 후 엔터
echo   3. "%LNK_NAME%" 삭제
echo -----------------------------------------
echo.
pause
exit /b 0
