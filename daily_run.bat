@echo off
cd /d "%~dp0"
call venv\Scripts\activate
python backup_db.py
python bot_alerts.py
pause