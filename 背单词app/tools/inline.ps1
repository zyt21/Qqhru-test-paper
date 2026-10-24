# Release packager: inline CSS/JS/test files and vendor xlsx into a single HTML
# Usage: powershell -File tools/inline.ps1   (run from project root)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'src'
$release = Join-Path $root 'release'
New-Item -ItemType Directory -Force -Path $release | Out-Null

$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [System.IO.File]::ReadAllText((Join-Path $src 'index.html'), [System.Text.Encoding]::UTF8)

# inline CSS
$html = [regex]::Replace($html, '<link rel="stylesheet" href="([^"]+)">', {
  param($m)
  $p = Join-Path $src (($m.Groups[1].Value) -replace '/', '\')
  if (Test-Path $p) {
    $css = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    return "<style>`n" + $css + "</style>"
  }
  return $m.Value
})

# inline JS (including ../test files)
$html = [regex]::Replace($html, '<script src="([^"]+)"></script>', {
  param($m)
  $p = Join-Path $src (($m.Groups[1].Value) -replace '/', '\')
  if (Test-Path $p) {
    $js = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    return "<script>`n" + $js + "</script>"
  }
  return $m.Value
})

# inline Excel parser (UMD, sets window.XLSX when executed)
# NOTE: insert before only the FIRST '</head>' (the real document head);
# other occurrences live inside JS string literals (e.g. print template) and must stay intact
$xlsxPath = Join-Path $src 'vendor\xlsx.full.min.js'
if (Test-Path $xlsxPath) {
  $xlsx = [System.IO.File]::ReadAllText($xlsxPath, [System.Text.Encoding]::UTF8)
  $m0 = [regex]::Match($html, '</head>')
  if ($m0.Success) {
    $html = $html.Substring(0, $m0.Index) + "<script id=""xlsx-lib"">`n" + $xlsx + "</script>`n" + $html.Substring($m0.Index)
  }
  Write-Output ('xlsx inlined: ' + $xlsx.Length + ' bytes')
} else {
  Write-Output 'xlsx vendor missing: Excel import will fall back to CSV guidance'
}

$outPath = Join-Path $release '背单词.html'
[System.IO.File]::WriteAllText($outPath, $html, $utf8)
Write-Output ('done: ' + $outPath + ' size=' + (Get-Item $outPath).Length)
