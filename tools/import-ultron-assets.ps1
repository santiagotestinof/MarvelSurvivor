param(
    [string]$Source = (Join-Path $PSScriptRoot '../character-studio/ultron-bots/imported/source')
)

# Importa la caminata de PixelLab sin modificar sus píxeles. Requiere PowerShell en Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$imported = Join-Path $root 'character-studio/ultron-bots/imported'
$destination = Join-Path $root 'public/assets/enemies/drone.png'
$directions = @('south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east')
$metadata = Get-Content -LiteralPath (Join-Path $Source 'metadata.json') -Raw | ConvertFrom-Json
$state = $metadata.states[0]
$animations = @($state.frames.animations.PSObject.Properties)
if ($animations.Count -ne 1) {
    throw 'El export debe contener una animacion de caminata.'
}
$walk = $animations[0].Value
$frameCount = @($walk.south).Count
if ($frameCount -lt 2) { throw 'La caminata debe tener al menos dos cuadros.' }
foreach ($direction in $directions) {
    if (@($walk.$direction).Count -ne $frameCount) {
        throw "Cantidad de cuadros inconsistente en $direction."
    }
}
$cell = 84
$sheet = [System.Drawing.Bitmap]::new($cell * $frameCount, $cell * $directions.Count)

try {
    for ($row = 0; $row -lt $directions.Count; $row++) {
        $paths = @($walk.($directions[$row]))
        for ($column = 0; $column -lt $frameCount; $column++) {
            $frame = [System.Drawing.Bitmap]::new((Join-Path $Source $paths[$column]))
            try {
                if ($frame.Width -ne $cell -or $frame.Height -ne $cell) {
                    throw "El cuadro $($paths[$column]) debe medir $($cell)x$cell."
                }
                for ($y = 0; $y -lt $cell; $y++) {
                    for ($x = 0; $x -lt $cell; $x++) {
                        $sheet.SetPixel($column * $cell + $x, $row * $cell + $y, $frame.GetPixel($x, $y))
                    }
                }
            } finally {
                $frame.Dispose()
            }
        }
    }
    New-Item -ItemType Directory -Force -Path $imported | Out-Null
    $sheet.Save((Join-Path $imported 'drone.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    Copy-Item -LiteralPath (Join-Path $imported 'drone.png') -Destination $destination
} finally {
    $sheet.Dispose()
}

Write-Output "Ultron bots importados: 8 direcciones, $frameCount cuadros por direccion, hoja de $($cell * $frameCount)x$($cell * $directions.Count)."
