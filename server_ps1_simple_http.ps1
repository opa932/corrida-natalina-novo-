$folder = 'C:\Users\User\Downloads\visual studio'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://127.0.0.1:8000/')
$listener.Start()
Write-Output "Listening on http://127.0.0.1:8000/ (serving $folder)"
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $raw = $req.RawUrl
    $path = $raw.TrimStart('/')
    if ($path -eq '') { $path = 'index2.html' }
    $file = Join-Path $folder $path
    if (Test-Path $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        switch ($ext) {
            '.html' { $context.Response.ContentType = 'text/html; charset=utf-8' }
            '.js'   { $context.Response.ContentType = 'application/javascript; charset=utf-8' }
            '.css'  { $context.Response.ContentType = 'text/css; charset=utf-8' }
            '.png'  { $context.Response.ContentType = 'image/png' }
            '.jpg'  { $context.Response.ContentType = 'image/jpeg' }
            default { $context.Response.ContentType = 'application/octet-stream' }
        }
        $context.Response.ContentLength64 = $bytes.Length
        $context.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } else {
        $context.Response.StatusCode = 404
        $resp = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
        $context.Response.ContentLength64 = $resp.Length
        $context.Response.OutputStream.Write($resp,0,$resp.Length)
    }
    $context.Response.Close()
}
$listener.Stop()
