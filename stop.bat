@echo off
title School Finance Manager — Stopping...
echo Stopping database containers...
powershell -ExecutionPolicy Bypass -Command "& 'C:\Program Files\Docker\Docker\resources\bin\docker.exe' compose --project-directory '%~dp0' stop"
echo Done. PostgreSQL and pgAdmin stopped.
echo (Your data is preserved. Run start.bat to restart.)
pause
