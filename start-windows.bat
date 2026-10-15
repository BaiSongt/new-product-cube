@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js/npm，请先安装 Node.js 22 或以上版本。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 首次运行需要 npm 安装依赖，须在有网络的研发电脑上执行。
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络或改用已预装依赖的开发环境。
    pause
    exit /b 1
  )
)
call npm run dev
pause
