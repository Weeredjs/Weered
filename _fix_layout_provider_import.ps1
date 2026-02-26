$ErrorActionPreference="Stop"

$Repo="C:\Weered"
$p = Join-Path $Repo "apps\web\app\layout.tsx"
if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$bak = "$p.bak_fix_provider_import_$ts"
Copy-Item -LiteralPath $p -Destination $bak -Force
Write-Host "OK Backup:" $bak

$t = Get-Content -Raw -LiteralPath $p

$old = 'import WeeredProvider from "../components/WeeredProvider";'
$new = 'import { WeeredProvider } from "../components/WeeredProvider";'

if ($t.Contains($old)) {
  $t = $t.Replace($old, $new)
  Write-Host "OK Patched: default -> named import for WeeredProvider"
} elseif ($t.Contains($new)) {
  Write-Host "OK Already patched (named import present)"
} else {
  throw "Could not find WeeredProvider import line to patch."
}

Set-Content -LiteralPath $p -Value $t -Force
Write-Host "OK Wrote:" $p

Write-Host ""
Write-Host "NEXT:"
Write-Host "  cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  Load /lobby"