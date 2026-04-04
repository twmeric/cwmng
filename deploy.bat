@echo off
REM Manual direct deploy script for Cloudflare Pages
REM Requires: npx wrangler (will prompt for login if not authenticated)

echo.
echo ==========================================
echo   Deploying cwmng to Cloudflare Pages
echo ==========================================
echo.

npx wrangler pages deploy . --project-name=cwmng --branch=main

echo.
echo Deployment complete. Visit your dashboard to verify:
echo https://dash.cloudflare.com/
echo.
pause
