$files = @(
    "fix_pin_temp.ts",
    "fix_sync.cjs",
    "test-html2canvas.ts",
    "rewrite_store.py",
    "update_sales_dashboard.py",
    "archive-fase2"
)
$files += Get-ChildItem -Path . -Filter "patch_*.py" | Select-Object -ExpandProperty Name
$files += Get-ChildItem -Path . -Filter "fix_*.py" | Select-Object -ExpandProperty Name

Write-Host "Starting cleanup..."

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Removing $file..."
        Remove-Item -Path $file -Recurse -Force
        
        Write-Host "Testing after removing $file..."
        cmd.exe /c "npm run lint && npm run build"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error occurred after deleting $file! Reverting..."
            git restore $file
        } else {
            Write-Host "Success for $file!"
        }
    }
}
Write-Host "Cleanup complete."
