@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === git config ===
git config user.name "azimish027"
git config user.email "azimish027@users.noreply.github.com"

echo === add ===
git add -A

echo === commit ===
git commit -m "feat: win98 desktop + therapon rebrand + fixes"

echo === push main ===
git push origin main

echo === checkout gh-pages ===
git checkout gh-pages

echo === merge main ===
git merge main --no-edit

echo === push gh-pages ===
git push origin gh-pages

echo === back to main ===
git checkout main

echo === DONE ===
echo Visit: https://azimish027.github.io/muse-phone/
