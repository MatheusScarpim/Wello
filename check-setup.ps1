# ==============================================
# 🔍 NxZap - Script de Verificação de Setup (Windows)
# ==============================================

Write-Host "🔍 Verificando configuração do NxZap..." -ForegroundColor Cyan
Write-Host ""

# Contadores
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

# Funções auxiliares
function Check-Pass {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
    $script:Passed++
}

function Check-Fail {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
    $script:Failed++
}

function Check-Warn {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
    $script:Warnings++
}

function Check-Info {
    param($Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# ==============================================
# 1. Verificar Docker
# ==============================================
Write-Host "📦 Verificando Docker..." -ForegroundColor Cyan

try {
    $dockerVersion = docker --version
    Check-Pass "Docker instalado: $dockerVersion"
} catch {
    Check-Fail "Docker NÃO encontrado"
}

try {
    $composeVersion = docker compose version
    Check-Pass "Docker Compose instalado: $composeVersion"
} catch {
    Check-Fail "Docker Compose NÃO encontrado"
}

Write-Host ""

# ==============================================
# 2. Verificar Arquivos
# ==============================================
Write-Host "📁 Verificando arquivos de configuração..." -ForegroundColor Cyan

if (Test-Path ".env") {
    Check-Pass "Arquivo .env existe"

    $envContent = Get-Content ".env" -Raw

    if ($envContent -match "TOKEN_META=" -and $envContent -match "CODE_META=") {
        Check-Pass "Credenciais Meta configuradas"
    } else {
        Check-Warn "Credenciais Meta podem estar faltando no .env"
    }

    if ($envContent -match "DB_URL=") {
        Check-Pass "URL do MongoDB configurada"
    } else {
        Check-Fail "DB_URL não encontrada no .env"
    }

    if ($envContent -match "PORT=(\d+)") {
        $port = $Matches[1]
        Check-Pass "Porta configurada: $port"
    } else {
        Check-Warn "Porta não especificada, usando padrão 8091"
    }
} else {
    Check-Fail "Arquivo .env NÃO encontrado"
    Check-Info "Copie .env.example para .env"
}

if (Test-Path "compose.yaml") {
    Check-Pass "compose.yaml existe"
} else {
    Check-Fail "compose.yaml NÃO encontrado"
}

if (Test-Path "Dockerfile") {
    Check-Pass "Dockerfile existe"
} else {
    Check-Fail "Dockerfile NÃO encontrado"
}

Write-Host ""

# ==============================================
# 3. Verificar Portas
# ==============================================
Write-Host "🔌 Verificando portas..." -ForegroundColor Cyan

$port8090 = Get-NetTCPConnection -LocalPort 8091 -ErrorAction SilentlyContinue
if ($port8090) {
    Check-Warn "Porta 8091 já está em uso (PID: $($port8090.OwningProcess))"
} else {
    Check-Pass "Porta 8091 disponível"
}

$port27018 = Get-NetTCPConnection -LocalPort 27018 -ErrorAction SilentlyContinue
if ($port27018) {
    Check-Warn "Porta 27018 (MongoDB) já está em uso (PID: $($port27018.OwningProcess))"
} else {
    Check-Pass "Porta 27018 disponível"
}

Write-Host ""

# ==============================================
# 4. Verificar Containers
# ==============================================
Write-Host "🐳 Verificando containers Docker..." -ForegroundColor Cyan

try {
    $containers = docker compose ps 2>&1

    if ($containers -match "nxzap-server") {
        if ($containers -match "nxzap-server.*Up") {
            Check-Pass "Container nxzap-server rodando"
        } else {
            Check-Warn "Container nxzap-server existe mas não está rodando"
        }
    } else {
        Check-Info "Container nxzap-server não existe (execute: docker compose up -d)"
    }

    if ($containers -match "nxzap-mongodb") {
        if ($containers -match "nxzap-mongodb.*Up") {
            Check-Pass "Container nxzap-mongodb rodando"
        } else {
            Check-Warn "Container nxzap-mongodb existe mas não está rodando"
        }
    } else {
        Check-Info "Container nxzap-mongodb não existe (execute: docker compose up -d)"
    }

    Write-Host ""
    Write-Host "📦 Verificando volumes..." -ForegroundColor Cyan

    $volumes = docker volume ls 2>&1

    if ($volumes -match "nxzap_mongodb_data") {
        Check-Pass "Volume mongodb_data existe"
    } else {
        Check-Info "Volume mongodb_data será criado no primeiro docker compose up"
    }
} catch {
    Check-Warn "Docker daemon não está rodando ou sem permissão"
}

Write-Host ""

# ==============================================
# 5. Verificar Node/pnpm
# ==============================================
Write-Host "🟢 Verificando ambiente Node..." -ForegroundColor Cyan

try {
    $nodeVersion = node --version
    Check-Pass "Node.js instalado: $nodeVersion"

    if ($nodeVersion -match "v2\d") {
        Check-Pass "Versão do Node compatível (>=20)"
    } else {
        Check-Warn "Versão do Node pode não ser compatível (recomendado: v20+)"
    }
} catch {
    Check-Warn "Node.js não encontrado (não necessário se usar Docker)"
}

try {
    $pnpmVersion = pnpm --version
    Check-Pass "pnpm instalado: $pnpmVersion"
} catch {
    Check-Warn "pnpm não encontrado (não necessário se usar Docker)"
}

if (Test-Path "node_modules") {
    Check-Pass "Dependências instaladas (node_modules existe)"
} else {
    Check-Info "Dependências não instaladas (execute: pnpm install)"
}

Write-Host ""

# ==============================================
# 6. Teste de Conectividade
# ==============================================
Write-Host "🌐 Testando conectividade..." -ForegroundColor Cyan

try {
    $containers = docker compose ps 2>&1
    if ($containers -match "nxzap-server.*Up") {
        Start-Sleep -Seconds 2

        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8091" -Method Get -TimeoutSec 5 -ErrorAction Stop
            Check-Pass "Servidor respondendo em http://localhost:8091"
        } catch {
            if ($_.Exception.Response.StatusCode -eq 404) {
                Check-Pass "Servidor respondendo em http://localhost:8091 (404 é normal se não houver rota /)"
            } else {
                Check-Warn "Servidor não está respondendo (pode estar inicializando)"
            }
        }
    }
} catch {
    # Container não está rodando
}

Write-Host ""

# ==============================================
# 7. Verificar .gitignore
# ==============================================
Write-Host "🔒 Verificando segurança..." -ForegroundColor Cyan

if (Test-Path ".gitignore") {
    $gitignore = Get-Content ".gitignore" -Raw

    if ($gitignore -match "\.env") {
        Check-Pass ".env está no .gitignore"
    } else {
        Check-Fail ".env NÃO está no .gitignore (RISCO DE SEGURANÇA!)"
    }
} else {
    Check-Warn ".gitignore não encontrado"
}

# Verificar se .env está sendo rastreado pelo git
if (Test-Path ".git") {
    try {
        $gitTracked = git ls-files --error-unmatch .env 2>&1
        if ($LASTEXITCODE -eq 0) {
            Check-Fail ".env está sendo rastreado pelo Git (REMOVA IMEDIATAMENTE!)"
            Check-Info "Execute: git rm --cached .env"
        } else {
            Check-Pass ".env não está sendo rastreado pelo Git"
        }
    } catch {
        Check-Pass ".env não está sendo rastreado pelo Git"
    }
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "📊 RESUMO" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "✅ Passou: $script:Passed" -ForegroundColor Green
Write-Host "⚠️  Avisos: $script:Warnings" -ForegroundColor Yellow
Write-Host "❌ Falhou: $script:Failed" -ForegroundColor Red
Write-Host ""

if ($script:Failed -eq 0) {
    Write-Host "🎉 Setup verificado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:"
    Write-Host "  1. docker compose up -d          # Subir containers"
    Write-Host "  2. docker compose logs -f server # Ver logs"
    Write-Host "  3. Acesse http://localhost:8091"
    exit 0
} else {
    Write-Host "⚠️  Há problemas que precisam ser resolvidos" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Consulte SETUP_COMPLETO.md para mais informações"
    exit 1
}

