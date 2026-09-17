$ErrorActionPreference = "Stop"

$source = Resolve-Path (Join-Path $PSScriptRoot "..\native\JotNativeHelper.cs")
$shortcutSource = Resolve-Path (Join-Path $PSScriptRoot "..\native\ShortcutState.cs")
$outputDirectory = Join-Path $PSScriptRoot "..\native\bin"
$output = Join-Path $outputDirectory "JotNativeHelper.exe"
$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$assemblyRoots = @("$env:WINDIR\Microsoft.NET\assembly\GAC_MSIL", "$env:WINDIR\assembly\GAC_MSIL")
$automationClient = $assemblyRoots | ForEach-Object { Get-ChildItem (Join-Path $_ "UIAutomationClient") -Recurse -Filter "UIAutomationClient.dll" -ErrorAction SilentlyContinue } | Select-Object -First 1 -ExpandProperty FullName
$automationTypes = $assemblyRoots | ForEach-Object { Get-ChildItem (Join-Path $_ "UIAutomationTypes") -Recurse -Filter "UIAutomationTypes.dll" -ErrorAction SilentlyContinue } | Select-Object -First 1 -ExpandProperty FullName

if (-not (Test-Path -LiteralPath $compiler)) {
    throw "The Windows C# compiler was not found at $compiler. Install .NET Framework 4.x Developer Tools."
}
if (-not $automationClient -or -not $automationTypes) {
    throw "Windows UI Automation assemblies were not found. Enable the .NET Framework 4.x Windows feature."
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
& $compiler /nologo /target:exe /optimize+ "/out:$output" /reference:System.dll /reference:System.Core.dll "/reference:$automationClient" "/reference:$automationTypes" $source $shortcutSource
if ($LASTEXITCODE -ne 0) {
    throw "Native helper compilation failed with exit code $LASTEXITCODE."
}
if (-not (Test-Path -LiteralPath $output)) {
    throw "The native helper executable is missing after compilation. Check Windows security history before rebuilding."
}

Write-Host "Built $output"
$audioSource = Resolve-Path (Join-Path $PSScriptRoot "..\native\ProcessAudio.cs")
$audioOutput = Join-Path $outputDirectory 'TakkieProcessAudio.exe'
$mixerSource = Resolve-Path (Join-Path $PSScriptRoot "..\native\AudioMixer.cs")
& $compiler /nologo /target:exe /platform:x64 /optimize+ "/out:$audioOutput" $audioSource $mixerSource
if ($LASTEXITCODE -ne 0) { throw 'Process audio helper compilation failed.' }
