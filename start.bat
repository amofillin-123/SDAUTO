@echo off
chcp 65001 > nul
title 文件拷贝程序启动器

echo 正在检查Python环境...
python --version > nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Python，请确保已安装Python并添加到系统环境变量
    echo 您可以从 https://www.python.org/downloads/ 下载安装Python
    pause
    exit /b 1
)

echo 正在检查依赖包...
pip show Flask > nul 2>&1
if errorlevel 1 (
    echo [提示] 正在安装必要的依赖包...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [错误] 依赖包安装失败
        pause
        exit /b 1
    )
)

echo 正在启动文件拷贝程序...
echo 程序启动后，请在浏览器中访问: http://localhost:3000

:retry_start
python app.py
if errorlevel 1 (
    echo [错误] 程序启动失败，请检查错误信息
    choice /C YN /M "是否重试启动？"
    if errorlevel 2 goto end
    if errorlevel 1 goto retry_start
)

:end
pause
