$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host ''
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host '       ELO - GERADOR AUTOMATICO APK' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

# Ambientes portateis usados no PC de desenvolvimento. Se Node/Java ja estiverem
# configurados no sistema, o script usa o ambiente existente normalmente.
$PortableNode = 'C:\Users\aqueiroz\Desktop\node-v24.20.0-win-x64'
$PortableJava = 'C:\Users\aqueiroz\Desktop\jdk-21.0.12.1'

if (Test-Path $PortableNode) {
    $env:Path = "$PortableNode;$env:Path"
    Write-Host '[OK] Node portatil configurado.' -ForegroundColor Green
}

if (Test-Path $PortableJava) {
    $env:JAVA_HOME = $PortableJava
    $env:Path = "$env:JAVA_HOME\bin;$env:Path"
    Write-Host '[OK] Java portatil configurado.' -ForegroundColor Green
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js nao encontrado. Instale/configure o Node ou ajuste $PortableNode em gerar-apk.ps1.'
}
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw 'Java nao encontrado. Instale/configure o JDK ou ajuste $PortableJava em gerar-apk.ps1.'
}

Write-Host "[INFO] Node: $(node --version)" -ForegroundColor DarkGray
Write-Host "[INFO] Java: $((java -version 2>&1 | Select-Object -First 1))" -ForegroundColor DarkGray
Write-Host ''

Write-Host '[1/5] Compilando CSS...' -ForegroundColor Yellow
& npm.cmd run build:css
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o CSS.' }

Write-Host '[2/5] Preparando arquivos web do Android...' -ForegroundColor Yellow
& npm.cmd run prepare:android:web
if ($LASTEXITCODE -ne 0) { throw 'Falha em prepare:android:web.' }

Write-Host '[3/5] Sincronizando Capacitor...' -ForegroundColor Yellow
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Falha ao sincronizar o Capacitor.' }

Set-Location (Join-Path $Root 'android')

Write-Host '[4/5] Limpando build Android anterior...' -ForegroundColor Yellow
& .\gradlew.bat clean
if ($LASTEXITCODE -ne 0) { throw 'Falha no Gradle clean.' }

Write-Host '[5/5] Gerando APK Debug...' -ForegroundColor Yellow
& .\gradlew.bat assembleDebug
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o APK.' }

$Apk = Join-Path $Root 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $Apk)) { throw "Build terminou, mas o APK nao foi encontrado em: $Apk" }

Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host '          APK GERADO COM SUCESSO!' -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
Write-Host $Apk -ForegroundColor Cyan
Write-Host ''

# Abre a pasta final para facilitar copiar o APK para o celular.
Start-Process explorer.exe -ArgumentList "/select,`"$Apk`""
