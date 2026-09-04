$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\src\assets\logo.png"
$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)

$sizes = @(16, 32, 48, 64, 128, 256)
$pngStreams = @()

foreach ($sz in $sizes) {
    $resized = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $sz, $sz)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $resized.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += ,@($sz, $ms.ToArray())
    $resized.Dispose()
    $ms.Dispose()
}

$srcBmp.Dispose()

# Create .ico file buffer
$outMs = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($outMs)

# ICONDIR
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type 1 = ICO
$bw.Write([uint16]$pngStreams.Count) # Image count

# Calculate offsets
$offset = 6 + ($pngStreams.Count * 16)

# Write ICONDIRENTRY for each size
foreach ($item in $pngStreams) {
    $sz = $item[0]
    $data = $item[1]
    
    $dimByte = [byte]0
    if ($sz -ne 256) {
        $dimByte = [byte]$sz
    }

    $bw.Write($dimByte) # Width (0 = 256)
    $bw.Write($dimByte) # Height (0 = 256)
    $bw.Write([byte]0) # Color count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32) # Bits per pixel
    $bw.Write([uint32]$data.Length) # Image size in bytes
    $bw.Write([uint32]$offset) # Offset
    
    $offset += $data.Length
}

# Write image data
foreach ($item in $pngStreams) {
    $bw.Write($item[1])
}

$bw.Flush()

# Save to destination paths
$destPaths = @(
    (Join-Path $PSScriptRoot "..\src\assets\icon.ico"),
    (Join-Path $PSScriptRoot "..\public\icon.ico"),
    (Join-Path $PSScriptRoot "..\build\icon.ico")
)

foreach ($dp in $destPaths) {
    $dir = Split-Path $dp -Parent
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    [System.IO.File]::WriteAllBytes($dp, $outMs.ToArray())
    Write-Host "Generated multi-res icon at: $dp"
}

# Also ensure public/icon.png and build/icon.png exist
$pngPaths = @(
    (Join-Path $PSScriptRoot "..\public\icon.png"),
    (Join-Path $PSScriptRoot "..\public\logo.png"),
    (Join-Path $PSScriptRoot "..\build\icon.png"),
    (Join-Path $PSScriptRoot "..\build\logo.png")
)
foreach ($pp in $pngPaths) {
    $dir = Split-Path $pp -Parent
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Copy-Item -Path $srcPath -Destination $pp -Force
    Write-Host "Copied logo asset to: $pp"
}

$bw.Dispose()
$outMs.Dispose()
Write-Host "Multi-resolution icon generation complete!"
