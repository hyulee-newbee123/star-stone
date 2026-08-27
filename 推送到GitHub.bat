@echo off
cd /d "%~dp0"
echo 正在推送到 GitHub ...
git push github master
if %ERRORLEVEL%==0 goto done
echo.
echo 直连 github.com 失败，改走 GitHub API ...
node push-via-api.js
:done
echo.
pause
