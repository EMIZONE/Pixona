<#
  PIXONA - servidor de desarrollo estatico, sin dependencias.
  Usa System.Net.HttpListener (incluido en Windows), no requiere Node ni Python.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080 -Open
#>
[CmdletBinding()]
param(
    [int]$Port = 5173,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$MimeTypes = @{
    '.html'  = 'text/html; charset=utf-8'
    '.htm'   = 'text/html; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.js'    = 'text/javascript; charset=utf-8'
    '.mjs'   = 'text/javascript; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.map'   = 'application/json; charset=utf-8'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.gif'   = 'image/gif'
    '.webp'  = 'image/webp'
    '.svg'   = 'image/svg+xml'
    '.ico'   = 'image/x-icon'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
    '.ttf'   = 'font/ttf'
    '.mp3'   = 'audio/mpeg'
    '.ogg'   = 'audio/ogg'
    '.wav'   = 'audio/wav'
    '.txt'   = 'text/plain; charset=utf-8'
    '.md'    = 'text/plain; charset=utf-8'
}

function Find-FreePort {
    param([int]$Start)

    for ($candidate = $Start; $candidate -lt ($Start + 40); $candidate++) {
        $available = $true
        $probe = $null
        try {
            $probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $candidate)
            $probe.Start()
        }
        catch {
            $available = $false
        }
        finally {
            if ($probe) { try { $probe.Stop() } catch { } }
        }
        if ($available) { return $candidate }
    }

    throw "No hay puerto libre entre $Start y $($Start + 40)."
}

$Port = Find-FreePort -Start $Port

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
}
catch {
    Write-Host "No pude abrir el puerto $Port : $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Prueba con otro puerto: .\serve.ps1 -Port 8080" -ForegroundColor Yellow
    exit 1
}

$url = "http://localhost:$Port/"

Write-Host ''
Write-Host '  PIXONA // servidor de desarrollo' -ForegroundColor Red
Write-Host "  $url" -ForegroundColor White
Write-Host "  raiz: $Root" -ForegroundColor DarkGray
Write-Host '  Ctrl+C para detener' -ForegroundColor DarkGray
Write-Host ''

if ($Open) { Start-Process $url }

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $code = 500

        try {
            $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
            if ([string]::IsNullOrEmpty($relative)) { $relative = 'index.html' }
            if ($relative.EndsWith('/')) { $relative = $relative + 'index.html' }

            $separator = [System.IO.Path]::DirectorySeparatorChar
            $candidate = [System.IO.Path]::GetFullPath(
                [System.IO.Path]::Combine($Root, $relative.Replace('/', $separator))
            )

            if (-not $candidate.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw 'ruta fuera de la raiz del proyecto'
            }
            if ([System.IO.Directory]::Exists($candidate)) {
                $candidate = [System.IO.Path]::Combine($candidate, 'index.html')
            }

            if (-not [System.IO.File]::Exists($candidate)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 - No encontrado: $relative")
                $response.StatusCode = 404
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
                $code = 404
            }
            else {
                $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
                $contentType = 'application/octet-stream'
                if ($MimeTypes.ContainsKey($extension)) { $contentType = $MimeTypes[$extension] }

                $bytes = [System.IO.File]::ReadAllBytes($candidate)
                $response.StatusCode = 200
                $response.ContentType = $contentType
                $response.AddHeader('Cache-Control', 'no-store')
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                $code = 200
            }
        }
        catch {
            try {
                $body = [System.Text.Encoding]::UTF8.GetBytes('403 - Prohibido')
                $response.StatusCode = 403
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
                $code = 403
            }
            catch { }
        }
        finally {
            try { $response.OutputStream.Close() } catch { }
        }

        Write-Host ("  {0}  {1}" -f $code, $request.RawUrl) -ForegroundColor DarkGray
    }
}
finally {
    $listener.Stop()
    $listener.Close()
    Write-Host ''
    Write-Host 'Servidor detenido.' -ForegroundColor DarkGray
}
