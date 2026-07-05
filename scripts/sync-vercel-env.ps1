# Sync .env.local → Vercel production env for maame-k-s-kitchen (bdsinc0101-sys).
# Prereqs: npx vercel login (bds.inc0101@gmail.com), then:
#   npx vercel link --scope bdsinc0101-sys --project maame-k-s-kitchen
# Usage: .\scripts\sync-vercel-env.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $root '.env.local'

if (-not (Test-Path $envFile)) {
  Write-Error ".env.local not found at $envFile"
}

$skipPatterns = @(
  '^#',
  '^$',
  'YOUR_',
  '^CREATE_ADMIN_PASSWORD=',
  '^RESEND_API_KEY=YOUR_'
)

Write-Host "Syncing production env vars from .env.local to linked Vercel project..." -ForegroundColor Cyan

Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  foreach ($pat in $skipPatterns) {
    if ($line -match $pat) { return }
  }
  if ($line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { return }

  $name = $Matches[1]
  $value = $Matches[2]

  # Prefer www for checkout redirects
  if ($name -eq 'NEXT_PUBLIC_APP_URL') {
    $value = 'https://www.maamekskitchen.ca'
  }

  if ([string]::IsNullOrWhiteSpace($value)) { return }

  Write-Host "  -> $name" -ForegroundColor DarkGray
  $value | npx vercel env add $name production --force 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Failed to set $name (is the project linked to bdsinc0101-sys/maame-k-s-kitchen?)"
  }
}

Write-Host ""
Write-Host "Done. Redeploy production:" -ForegroundColor Green
Write-Host "  npx vercel --prod --scope bdsinc0101-sys"
