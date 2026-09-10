@echo off
setlocal
cd /d "%~dp0"
py -3.11 -c "import struct; assert struct.calcsize('P') == 8" >nul 2>&1
if errorlevel 1 (
  echo Please install 64-bit Python 3.11 from python.org, then run start.bat again.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv
  if errorlevel 1 goto fail
)
if not exist ".venv\installed-v1" (
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  if errorlevel 1 goto fail
  type nul > .venv\installed-v1
)
.venv\Scripts\python.exe app.py
if errorlevel 1 goto fail
exit /b 0
:fail
echo Startup failed. Please keep the error above and send it to the developer.
pause
exit /b 1
