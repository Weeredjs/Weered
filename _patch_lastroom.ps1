$ErrorActionPreference = "Stop"

function Find-AppBase {
  $webDir = "C:\Weered\apps\web"
  $a = Join-Path $webDir "app"
  $b = Join-Path $webDir "src\app"
  if ([System.IO.Directory]::Exists($a)) { return $a }
  if ([System.IO.Directory]::Exists($b)) { return $b }
  throw "Cannot find Next app base at: $a or $b"
}

$appBase = Find-AppBase
Write-Host "Using app base:" $appBase

# Find RoomTools.tsx anywhere under appBase (bracket-safe)
$rtFiles = [System.IO.Directory]::GetFiles($appBase, "RoomTools.tsx", [System.IO.SearchOption]::AllDirectories)
if (-not $rtFiles -or $rtFiles.Count -eq 0) { throw "No RoomTools.tsx found under $appBase" }

# Prefer the one under room\[roomId]
$roomTools = $null
foreach ($p in $rtFiles) {
  $low = $p.ToLower()
  if ($low.Contains("room\[roomid]".ToLower())) { $roomTools = $p; break }
}
if (-not $roomTools) { $roomTools = $rtFiles[0] }
Write-Host "RoomTools:" $roomTools

$homePage = Join-Path $appBase "page.tsx"
if (-not [System.IO.File]::Exists($homePage)) { throw "Missing home page: $homePage" }
Write-Host "Home page:" $homePage

# -------------------------
# 1) RoomTools: ensure it writes weered:lastRoomId
# -------------------------
$rt = [System.IO.File]::ReadAllText($roomTools, [System.Text.UTF8Encoding]::new($false))
if ($rt -notmatch "weered:lastRoomId") {
  $retPos = $rt.IndexOf("return (")
  if ($retPos -lt 0) { $retPos = $rt.IndexOf("return(") }
  if ($retPos -lt 0) { throw "RoomTools: can't find return( to insert before" }

  $insert = @"
  useEffect(() => {
    try { window.localStorage.setItem('weered:lastRoomId', roomId) } catch {}
  }, [roomId])

"@
  $rt = $rt.Insert($retPos, $insert)
  [System.IO.File]::WriteAllText($roomTools, $rt, [System.Text.UTF8Encoding]::new($false))
  Write-Host "OK: RoomTools now writes weered:lastRoomId"
} else {
  Write-Host "SKIP: RoomTools already writes weered:lastRoomId"
}

# -------------------------
# 2) Home page: add robust auto-jump useEffect (interval)
#    Redirects only when we're on '/', and both token + lastRoomId exist.
# -------------------------
$hp = [System.IO.File]::ReadAllText($homePage, [System.Text.UTF8Encoding]::new($false))

# Ensure 'use client' at top
if ($hp -notmatch "^\s*'use client'") {
  $hp = "'use client'`r`n`r`n" + $hp
}

# Ensure useEffect import
if ($hp -match "from\s+['""]react['""]") {
  if ($hp -match "import\s+\{[^}]*\}") {
    if ($hp -notmatch "\buseEffect\b") {
      $hp = [Regex]::Replace($hp, "import\s+\{\s*", "import { useEffect, ", 1)
    }
  } elseif ($hp -notmatch "\buseEffect\b") {
    $hp = [Regex]::Replace($hp, "^\s*'use client'\s*", "'use client'`r`n`r`nimport { useEffect } from 'react'`r`n", 1)
  }
} elseif ($hp -notmatch "\buseEffect\b") {
  $hp = [Regex]::Replace($hp, "^\s*'use client'\s*", "'use client'`r`n`r`nimport { useEffect } from 'react'`r`n", 1)
}

# Only insert once
if ($hp -notmatch "auto-jump: last room after login") {
  $fnIdx = $hp.IndexOf("export default function")
  if ($fnIdx -lt 0) { throw "Home page: can't find 'export default function'" }
  $braceIdx = $hp.IndexOf("{", $fnIdx)
  if ($braceIdx -lt 0) { throw "Home page: can't find '{' for default export function" }

  $effect = @"
  // auto-jump: last room after login
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.pathname !== '/') return

    let tries = 0
    const id = window.setInterval(() => {
      tries++
      if (tries > 40) { window.clearInterval(id); return }

      try {
        const last = window.localStorage.getItem('weered:lastRoomId')
        if (!last || !last.trim()) return

        let tok =
          window.localStorage.getItem('weered:token') ||
          window.localStorage.getItem('token') ||
          window.localStorage.getItem('authToken') ||
          window.localStorage.getItem('accessToken') ||
          window.localStorage.getItem('jwt')

        if ((!tok || !tok.trim())) {
          const raw = window.localStorage.getItem('weered:auth')
          if (raw && raw.trim().startsWith('{')) {
            try {
              const obj = JSON.parse(raw)
              tok = (obj && (obj.token || obj.accessToken || obj.jwt)) ? String(obj.token || obj.accessToken || obj.jwt) : tok
            } catch {}
          }
        }

        if (!tok || !tok.trim()) return

        window.clearInterval(id)
        window.location.href = '/room/' + encodeURIComponent(last.trim())
      } catch {}
    }, 250)

    return () => window.clearInterval(id)
  }, [])

"@

  $hp = $hp.Insert($braceIdx + 1, "`r`n" + $effect)
  [System.IO.File]::WriteAllText($homePage, $hp, [System.Text.UTF8Encoding]::new($false))
  Write-Host "OK: Home page auto-jump inserted"
} else {
  Write-Host "SKIP: Home page already has auto-jump"
}