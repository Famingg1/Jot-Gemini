$ErrorActionPreference = "Stop"

$source = Resolve-Path (Join-Path $PSScriptRoot "..\native\JotNativeHelper.cs")
$outputDirectory = Join-Path $PSScriptRoot "..\native\bin"
$output = Join-Path $outputDirectory "JotNativeHelper.exe"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$automationClient = Get-ChildItem "C:\Windows\assembly\GAC_MSIL\UIAutomationClient" -Recurse -Filter "UIAutomationClient.dll" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
$automationTypes = Get-ChildItem "C:\Windows\assembly\GAC_MSIL\UIAutomationTypes" -Recurse -Filter "UIAutomationTypes.dll" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

if (-not (Test-Path -LiteralPath $compiler)) {
    throw "The Windows C# compiler was not found at $compiler. Install .NET Framework 4.x Developer Tools."
}
if (-not $automationClient -or -not $automationTypes) {
    throw "Windows UI Automation assemblies were not found. Enable the .NET Framework 4.x Windows feature."
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
& $compiler /nologo /target:exe /optimize+ "/out:$output" /reference:System.dll /reference:System.Core.dll "/reference:$automationClient" "/reference:$automationTypes" $source
if ($LASTEXITCODE -ne 0) {
    throw "Native helper compilation failed with exit code $LASTEXITCODE."
}

Write-Host "Built $output"
