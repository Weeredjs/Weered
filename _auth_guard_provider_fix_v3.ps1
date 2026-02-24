$ErrorActionPreference = "Stop"

$Repo = "C:\Weered"
$p = Join-Path $Repo "apps\web\components\WeeredProvider.tsx"
if (!(Test-Path -LiteralPath $p)) { throw "Missing: $p" }

function Backup-File([string]$Path) {
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  Copy-Item -LiteralPath $Path -Destination "$Path.bak_providerfix_$ts" -Force
  Write-Host "✅ Backup:" "$Path.bak_providerfix_$ts"
}

function Write-FileUtf8NoBom([string]$Path, [string]$Content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
  Write-Host "✅ Wrote:" $Path
}

Backup-File $p
$t = Get-Content -Raw -LiteralPath $p

# --- 1) Ensure next/navigation useRouter import exists ---
if ($t -notmatch 'from\s*"next/navigation";') {
  if ($t -match '"use client";') {
    $t = [regex]::Replace(
      $t,
      '("use client";\s*\r?\n)',
      ('$1' + 'import { useRouter } from "next/navigation";' + "`r`n"),
      1
    )
  } else {
    $t = 'import { useRouter } from "next/navigation";' + "`r`n" + $t
  }
} else {
  if ($t -notmatch '\buseRouter\b') {
    $m = [regex]::Match($t, 'import\s*\{([^}]*)\}\s*from\s*"next/navigation";')
    if ($m.Success) {
      $inside = $m.Groups[1].Value.Trim()
      if ($inside.Length -gt 0) { $newInside = $inside + ", useRouter" } else { $newInside = "useRouter" }
      $t = [regex]::Replace($t, 'import\s*\{([^}]*)\}\s*from\s*"next/navigation";', ('import { ' + $newInside + ' } from "next/navigation";'), 1)
    } else {
      if ($t -match '"use client";') {
        $t = [regex]::Replace(
          $t,
          '("use client";\s*\r?\n)',
          ('$1' + 'import { useRouter } from "next/navigation";' + "`r`n"),
          1
        )
      } else {
        $t = 'import { useRouter } from "next/navigation";' + "`r`n" + $t
      }
    }
  }
}

# --- 2) Ensure router declaration inside WeeredProvider component ---
if ($t -notmatch '\bconst\s+router\s*=\s*useRouter\(\)\s*;') {
  $t2 = [regex]::Replace($t, '(export\s+function\s+WeeredProvider\s*\([^\)]*\)\s*\{)', ('$1' + "`r`n  const router = useRouter();"), 1)
  if ($t2 -eq $t) {
    $t2 = [regex]::Replace($t, '(\bfunction\s+WeeredProvider\s*\([^\)]*\)\s*\{)', ('$1' + "`r`n  const router = useRouter();"), 1)
  }
  if ($t2 -eq $t) {
    $t2 = [regex]::Replace($t, '(\bconst\s+WeeredProvider\s*=\s*\([^\)]*\)\s*=>\s*\{)', ('$1' + "`r`n  const router = useRouter();"), 1)
  }
  if ($t2 -eq $t) {
    Write-Host "⚠ Could not find WeeredProvider component signature to insert router. Skipping router insertion."
  } else {
    $t = $t2
  }
}

# --- 3) Ensure logout redirects to / ---
if ($t -notmatch 'router\.replace\(\s*["'']\/["'']\s*\)') {
  $m3 = [regex]::Match($t, '(function\s+logout\s*\([^\)]*\)\s*\{[\s\S]*?\r?\n\s*\})')
  if ($m3.Success) {
    $block = $m3.Groups[1].Value
    $block2 = $block

    if ($block2 -match 'wsRef\.current\s*=\s*null;') {
      $block2 = [regex]::Replace($block2, '(wsRef\.current\s*=\s*null;\s*)', ('$1' + "`r`n    try { router.replace(`"/`"); } catch {}" + "`r`n"), 1)
    } else {
      $block2 = [regex]::Replace($block2, '(\r?\n\s*\})$', ("`r`n    try { router.replace(`"/`"); } catch {}" + '$1'), 1)
    }

    $t = $t.Replace($block, $block2)
  } else {
    $m4 = [regex]::Match($t, '(\bconst\s+logout\s*=\s*\([^\)]*\)\s*=>\s*\{[\s\S]*?\r?\n\s*\};)')
    if ($m4.Success) {
      $block = $m4.Groups[1].Value
      $block2 = $block
      $block2 = [regex]::Replace($block2, '(\r?\n\s*\};)$', ("`r`n  try { router.replace(`"/`"); } catch {}" + '$1'), 1)
      $t = $t.Replace($block, $block2)
    } else {
      Write-Host "⚠ Could not locate logout() block to inject redirect."
    }
  }
}

Write-FileUtf8NoBom $p $t

Write-Host ""
Write-Host "NEXT:"
Write-Host "  1) Restart web: cd C:\Weered\apps\web ; pnpm dev"
Write-Host "  2) Visit /lobby without token -> should redirect to /"
Write-Host "  3) Logout -> should return to / and WS should drop"
