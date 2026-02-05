#!/bin/bash

# ==============================================
# 🔍 NxZap - Script de Verificação de Setup
# ==============================================

set -e

echo "🔍 Verificando configuração do NxZap..."
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0
WARNINGS=0

# Função para verificar
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $2${NC}"
        ((FAILED++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

info() {
    echo -e "ℹ️  $1"
}

# ==============================================
# 1. Verificar Docker
# ==============================================
echo "📦 Verificando Docker..."

if command -v docker &> /dev/null; then
    check 0 "Docker instalado: $(docker --version)"
else
    check 1 "Docker NÃO encontrado"
fi

if command -v docker compose &> /dev/null; then
    check 0 "Docker Compose instalado: $(docker compose version)"
elif command -v docker-compose &> /dev/null; then
    check 0 "Docker Compose instalado: $(docker-compose --version)"
    warn "Use 'docker compose' (com espaço) ao invés de 'docker-compose'"
else
    check 1 "Docker Compose NÃO encontrado"
fi

echo ""

# ==============================================
# 2. Verificar Arquivos
# ==============================================
echo "📁 Verificando arquivos de configuração..."

if [ -f ".env" ]; then
    check 0 "Arquivo .env existe"

    # Verificar variáveis críticas
    if grep -q "TOKEN_META=" .env && grep -q "CODE_META=" .env; then
        check 0 "Credenciais Meta configuradas"
    else
        warn "Credenciais Meta podem estar faltando no .env"
    fi

    if grep -q "DB_URL=" .env; then
        check 0 "URL do MongoDB configurada"
    else
        check 1 "DB_URL não encontrada no .env"
    fi

    if grep -q "PORT=" .env; then
        PORT=$(grep "PORT=" .env | cut -d '=' -f2)
        check 0 "Porta configurada: $PORT"
    else
        warn "Porta não especificada, usando padrão 8091"
    fi
else
    check 1 "Arquivo .env NÃO encontrado"
    info "Copie .env.example para .env: cp .env.example .env"
fi

if [ -f "compose.yaml" ]; then
    check 0 "compose.yaml existe"
else
    check 1 "compose.yaml NÃO encontrado"
fi

if [ -f "Dockerfile" ]; then
    check 0 "Dockerfile existe"
else
    check 1 "Dockerfile NÃO encontrado"
fi

echo ""

# ==============================================
# 3. Verificar Portas
# ==============================================
echo "🔌 Verificando portas..."

if command -v lsof &> /dev/null; then
    if lsof -i :8091 &> /dev/null; then
        warn "Porta 8091 já está em uso"
        info "$(lsof -i :8091)"
    else
        check 0 "Porta 8091 disponível"
    fi

    if lsof -i :27018 &> /dev/null; then
        warn "Porta 27018 (MongoDB) já está em uso"
    else
        check 0 "Porta 27018 disponível"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -an | grep -q ":8091"; then
        warn "Porta 8091 pode estar em uso"
    else
        check 0 "Porta 8091 disponível"
    fi

    if netstat -an | grep -q ":27018"; then
        warn "Porta 27018 (MongoDB) pode estar em uso"
    else
        check 0 "Porta 27018 disponível"
    fi
else
    warn "Não foi possível verificar portas (lsof/netstat não encontrado)"
fi

echo ""

# ==============================================
# 4. Verificar Containers (se Docker rodando)
# ==============================================
echo "🐳 Verificando containers Docker..."

if docker ps &> /dev/null; then
    if docker compose ps | grep -q "nxzap-server"; then
        if docker compose ps | grep "nxzap-server" | grep -q "Up"; then
            check 0 "Container nxzap-server rodando"
        else
            warn "Container nxzap-server existe mas não está rodando"
        fi
    else
        info "Container nxzap-server não existe (execute: docker compose up -d)"
    fi

    if docker compose ps | grep -q "nxzap-mongodb"; then
        if docker compose ps | grep "nxzap-mongodb" | grep -q "Up"; then
            check 0 "Container nxzap-mongodb rodando"
        else
            warn "Container nxzap-mongodb existe mas não está rodando"
        fi
    else
        info "Container nxzap-mongodb não existe (execute: docker compose up -d)"
    fi

    # Verificar volumes
    echo ""
    echo "📦 Verificando volumes..."
    if docker volume ls | grep -q "nxzap_mongodb_data"; then
        check 0 "Volume mongodb_data existe"
    else
        info "Volume mongodb_data será criado no primeiro docker compose up"
    fi
else
    warn "Docker daemon não está rodando ou sem permissão"
fi

echo ""

# ==============================================
# 5. Verificar Node/pnpm (para dev local)
# ==============================================
echo "🟢 Verificando ambiente Node..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check 0 "Node.js instalado: $NODE_VERSION"

    # Verificar se é versão compatível
    if [[ "$NODE_VERSION" =~ ^v2[0-9] ]]; then
        check 0 "Versão do Node compatível (>=20)"
    else
        warn "Versão do Node pode não ser compatível (recomendado: v20+)"
    fi
else
    warn "Node.js não encontrado (não necessário se usar Docker)"
fi

if command -v pnpm &> /dev/null; then
    check 0 "pnpm instalado: $(pnpm --version)"
else
    warn "pnpm não encontrado (não necessário se usar Docker)"
fi

if [ -d "node_modules" ]; then
    check 0 "Dependências instaladas (node_modules existe)"
else
    info "Dependências não instaladas (execute: pnpm install)"
fi

echo ""

# ==============================================
# 6. Teste de Conectividade
# ==============================================
echo "🌐 Testando conectividade..."

if docker compose ps | grep "nxzap-server" | grep -q "Up"; then
    sleep 2  # Aguarda o container estar pronto

    # Testa endpoint (ajuste a porta se necessário)
    if command -v curl &> /dev/null; then
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:8091 | grep -q "200\|404"; then
            check 0 "Servidor respondendo em http://localhost:8091"
        else
            warn "Servidor não está respondendo (pode estar inicializando)"
        fi
    else
        warn "curl não encontrado, não foi possível testar conectividade"
    fi
fi

echo ""

# ==============================================
# 7. Verificar .gitignore
# ==============================================
echo "🔒 Verificando segurança..."

if [ -f ".gitignore" ]; then
    if grep -q ".env" .gitignore; then
        check 0 ".env está no .gitignore"
    else
        check 1 ".env NÃO está no .gitignore (RISCO DE SEGURANÇA!)"
    fi
else
    warn ".gitignore não encontrado"
fi

# Verificar se .env está sendo rastreado pelo git
if [ -d ".git" ]; then
    if git ls-files --error-unmatch .env &> /dev/null; then
        check 1 ".env está sendo rastreado pelo Git (REMOVA IMEDIATAMENTE!)"
        info "Execute: git rm --cached .env"
    else
        check 0 ".env não está sendo rastreado pelo Git"
    fi
fi

echo ""
echo "=============================================="
echo "📊 RESUMO"
echo "=============================================="
echo -e "${GREEN}✅ Passou: $PASSED${NC}"
echo -e "${YELLOW}⚠️  Avisos: $WARNINGS${NC}"
echo -e "${RED}❌ Falhou: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Setup verificado com sucesso!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. docker compose up -d          # Subir containers"
    echo "  2. docker compose logs -f server # Ver logs"
    echo "  3. Acesse http://localhost:8091"
    exit 0
else
    echo -e "${RED}⚠️  Há problemas que precisam ser resolvidos${NC}"
    echo ""
    echo "Consulte SETUP_COMPLETO.md para mais informações"
    exit 1
fi

