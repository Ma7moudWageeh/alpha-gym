taskkill /f /im explorer.exe
Start-Sleep -Milliseconds 500
Remove-Item -Force "$env:LOCALAPPDATA\IconCache.db" -ErrorAction SilentlyContinue
Remove-Item -Force "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*" -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Start-Process explorer.exe
Write-Host "Windows icon cache cleared and Explorer restarted."
