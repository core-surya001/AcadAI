@echo off
set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
set "PGPASSWORD=112004"

echo.
echo === Step 1: Creating database 'acadai' ===
"%PGBIN%\createdb.exe" -U postgres acadai 2>nul
if %ERRORLEVEL%==0 (
    echo Database created!
) else (
    echo Database may already exist, continuing...
)

echo.
echo === Step 2: Running migrations ===
call npm run migrate

echo.
echo === Step 3: Seeding demo data ===
call npm run seed

echo.
echo === DONE ===
