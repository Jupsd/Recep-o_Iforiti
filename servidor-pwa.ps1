$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 8080

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$listener.Start()
Write-Output ("PWA Servidor Iforiti ativo em http://localhost:{0}" -f $port)

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 3000
      $client.SendTimeout = 5000
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      # Consume remaining HTTP headers until blank line
      while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line -or $line -eq '') { break }
      }

      $parts = $requestLine.Split(' ')
      $method = if ($parts.Length -ge 1) { $parts[0].ToUpperInvariant() } else { 'GET' }
      $rawTarget = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
      $pathOnly = ($rawTarget.Split('?')[0]).Trim()
      if ([string]::IsNullOrEmpty($pathOnly)) { $pathOnly = '/' }

      $fileRel = $null
      $contentType = 'application/octet-stream'

      switch ($pathOnly.ToLowerInvariant()) {
        '/' {
          $fileRel = 'abrir-local.html'
          $contentType = 'text/html; charset=utf-8'
        }
        '/index.html' {
          $fileRel = 'abrir-local.html'
          $contentType = 'text/html; charset=utf-8'
        }
        '/abrir-local.html' {
          $fileRel = 'abrir-local.html'
          $contentType = 'text/html; charset=utf-8'
        }
        '/manifest.json' {
          $fileRel = 'public\manifest.json'
          $contentType = 'application/manifest+json; charset=utf-8'
        }
        '/public/manifest.json' {
          $fileRel = 'public\manifest.json'
          $contentType = 'application/manifest+json; charset=utf-8'
        }
        '/sw.js' {
          $fileRel = 'public\sw.js'
          $contentType = 'application/javascript; charset=utf-8'
        }
        '/public/sw.js' {
          $fileRel = 'public\sw.js'
          $contentType = 'application/javascript; charset=utf-8'
        }
        '/logo.png' {
          $fileRel = 'public\logo.png'
          $contentType = 'image/png'
        }
        '/public/logo.png' {
          $fileRel = 'public\logo.png'
          $contentType = 'image/png'
        }
        '/favicon.ico' {
          $fileRel = 'public\logo.png'
          $contentType = 'image/png'
        }
      }

      $fullPath = if ($fileRel) { Join-Path $root $fileRel } else { $null }

      if ($fullPath -and (Test-Path -LiteralPath $fullPath)) {
        $bodyBytes = [System.IO.File]::ReadAllBytes($fullPath)
        $headerStr = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bodyBytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($method -ne 'HEAD' -and $bodyBytes.Length -gt 0) {
          $stream.Write($bodyBytes, 0, $bodyBytes.Length)
        }
      } else {
        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $headerStr = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($notFoundBytes.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        if ($method -ne 'HEAD') {
          $stream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }
      }
      $stream.Flush()
    } catch {
      # Ignore client disconnects / aborted requests so server remains alive
    } finally {
      try { $client.Close() } catch {}
    }
  }
} finally {
  try { $listener.Stop() } catch {}
}

