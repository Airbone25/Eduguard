[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [string]$ListenAddress = '127.0.0.1',
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$backendPython = Join-Path $PSScriptRoot '.venv312\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $backendPython -PathType Leaf)) {
    throw 'The .venv312 environment is missing. Follow the Python 3.12 setup in backend/README.md.'
}

Push-Location -LiteralPath $PSScriptRoot
try {
    $backendVersion = & $backendPython -c "import sys; print('%s.%s' % sys.version_info[:2])"
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not run .venv312 Python. See the environment repair instructions in backend/README.md.'
    }
    if ($backendVersion.Trim() -ne '3.12') {
        throw ".venv312 runs Python $backendVersion, but its packages require Python 3.12. See 'Repair a Python version mismatch' in backend/README.md. Activating the folder does not change its Python version."
    }

    & $backendPython -c "import numpy, pydantic_core, sklearn; from app.main import app; print('Backend imports verified with Python 3.12.')"
    if ($LASTEXITCODE -ne 0) {
        throw 'Backend imports failed. Check the .venv312 dependencies using the instructions in backend/README.md.'
    }
    if (-not $CheckOnly) {
        & $backendPython -m uvicorn app.main:app --host $ListenAddress --port $Port
        if ($LASTEXITCODE -ne 0) {
            throw "The API exited with code $LASTEXITCODE. See the server error above."
        }
    }
}
finally {
    Pop-Location
}
