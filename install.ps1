# Antigravity Context Window Monitor - Windows Installer & Updater
# Usage:
# irm https://raw.githubusercontent.com/walter-garay/antigravity-context-monitor/main/install.ps1 | iex

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  🚀 Antigravity Context Window Monitor Installer / Updater" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$pluginDir = Join-Path $HOME ".gemini\config\plugins\context-monitor"
Write-Host "📁 Destino: $pluginDir" -ForegroundColor Gray

# Create directories
$panelDir = Join-Path $pluginDir "sidecars\panel"
$assetsDir = Join-Path $pluginDir "assets"
New-Item -ItemType Directory -Path $assetsDir, $panelDir -Force | Out-Null

$rawBase = "https://raw.githubusercontent.com/walter-garay/antigravity-context-monitor/main"

$files = @(
    "plugin.json",
    "assets/logo.svg",
    "sidecars/panel/sidecar.json",
    "sidecars/panel/package.json",
    "sidecars/panel/main.mjs",
    "sidecars/panel/index.html",
    "sidecars/panel/app.js",
    "sidecars/panel/styles.css"
)

Write-Host "⬇️ Descargando componentes más recientes..." -ForegroundColor Yellow
foreach ($file in $files) {
    $target = Join-Path $pluginDir $file.Replace('/', '\')
    $targetParent = Split-Path $target -Parent
    if (!(Test-Path $targetParent)) {
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    }
    $url = "$rawBase/$file`?_t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
    try {
        Invoke-WebRequest -Uri $url -OutFile $target -UseBasicParsing
        Write-Host "  ✓ $file" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Error al descargar $file : $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n⚡ Registrando plugin en Antigravity..." -ForegroundColor Yellow
if ($env:ANTIGRAVITY_LS_ADDRESS -and $env:ANTIGRAVITY_CSRF_TOKEN) {
    try {
        $body = '{"userConfig":{"plugins":{"context-monitor":{"enabled":true}}}}'
        Invoke-RestMethod -Uri "http://$($env:ANTIGRAVITY_LS_ADDRESS)/exa.language_server_pb.LanguageServerService/JetboxWriteState" -Method POST -Headers @{
            "Content-Type" = "application/json"
            "x-codeium-csrf-token" = $env:ANTIGRAVITY_CSRF_TOKEN
        } -Body $body | Out-Null
        Write-Host "✓ Plugin habilitado automáticamente en la sesión actual." -ForegroundColor Green
    } catch {
        Write-Host "! Nota: Si no está activo aún, actívalo en Customizations -> Installed." -ForegroundColor Gray
    }
}

Write-Host "`n🎉 ¡Instalación / Actualización completada con éxito!" -ForegroundColor Cyan
Write-Host "👉 En Antigravity Desktop: Abre cualquier chat -> Menú ⋮ (arriba derecha) -> Extensions -> Context Monitor." -ForegroundColor White
