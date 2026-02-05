#!/usr/bin/env node

/**
 * Script CLI para gerar tokens JWT
 * Uso: node scripts/generate-token.js [userId] [expiresIn]
 */

const jwt = require('jsonwebtoken')
const readline = require('readline')
const fs = require('fs')
const path = require('path')

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

// Carrega .env
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env')

  if (!fs.existsSync(envPath)) {
    log('⚠️  Arquivo .env não encontrado!', colors.yellow)
    log('Usando secret padrão (NÃO RECOMENDADO PARA PRODUÇÃO)', colors.yellow)
    return 'default-secret-change-me'
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const jwtSecretMatch = envContent.match(/JWT_SECRET=(.+)/)

  if (!jwtSecretMatch) {
    log('⚠️  JWT_SECRET não encontrado no .env!', colors.yellow)
    log('Usando secret padrão (NÃO RECOMENDADO PARA PRODUÇÃO)', colors.yellow)
    return 'default-secret-change-me'
  }

  return jwtSecretMatch[1].trim()
}

// Interface para input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function main() {
  log('\n╔════════════════════════════════════════╗', colors.blue)
  log('║   🔐 Gerador de Tokens JWT - NxZap   ║', colors.blue)
  log('╚════════════════════════════════════════╝\n', colors.blue)

  const secret = loadEnv()
  log(`✅ JWT_SECRET carregado\n`, colors.green)

  // Argumentos da linha de comando
  const args = process.argv.slice(2)

  let userId = args[0]
  let expiresIn = args[1] || '365d'
  let email = args[2] || ''
  let role = args[3] || 'user'

  // Se não passou argumentos, pergunta
  if (!userId) {
    log('📝 Responda as perguntas abaixo para gerar seu token:\n', colors.bright)

    userId = await question('User ID (obrigatório): ')

    if (!userId) {
      log('❌ User ID é obrigatório!', colors.red)
      rl.close()
      process.exit(1)
    }

    email = await question('Email (opcional): ')
    role = await question('Role [user/admin/service] (padrão: user): ') || 'user'

    const expiry = await question('Expiração [24h/7d/30d/365d/never] (padrão: 365d): ')
    expiresIn = expiry === 'never' ? '999y' : (expiry || '365d')
  }

  log('\n⏳ Gerando token...', colors.yellow)

  // Gera o token
  const payload = {
    userId,
    email: email || undefined,
    role,
  }

  const token = jwt.sign(payload, secret, { expiresIn })

  // Decodifica para mostrar informações
  const decoded = jwt.decode(token)

  log('\n╔════════════════════════════════════════╗', colors.green)
  log('║        ✅ Token Gerado com Sucesso!   ║', colors.green)
  log('╚════════════════════════════════════════╝\n', colors.green)

  log('📋 Informações do Token:', colors.bright)
  log(`   User ID: ${colors.blue}${decoded.userId}${colors.reset}`)
  if (decoded.email) log(`   Email: ${colors.blue}${decoded.email}${colors.reset}`)
  log(`   Role: ${colors.blue}${decoded.role}${colors.reset}`)
  log(`   Expira em: ${colors.blue}${expiresIn}${colors.reset}`)
  log(`   Criado em: ${colors.blue}${new Date(decoded.iat * 1000).toISOString()}${colors.reset}`)
  log(`   Expira em: ${colors.blue}${new Date(decoded.exp * 1000).toISOString()}${colors.reset}`)

  log('\n🔑 Seu Token:', colors.bright)
  log(`${colors.green}${token}${colors.reset}\n`)

  log('📦 Como usar:', colors.bright)
  log(`   Header: ${colors.yellow}Authorization${colors.reset}`)
  log(`   Value: ${colors.yellow}Bearer ${token}${colors.reset}\n`)

  log('💡 Exemplo cURL:', colors.bright)
  log(`${colors.yellow}curl -H "Authorization: Bearer ${token}" http://localhost:8091/api/auth/test${colors.reset}\n`)

  log('💡 Exemplo JavaScript:', colors.bright)
  log(`${colors.yellow}fetch('http://localhost:8091/api/auth/test', {
  headers: {
    'Authorization': 'Bearer ${token}'
  }
})${colors.reset}\n`)

  log('💡 Salvar no arquivo:', colors.bright)
  const saveToken = await question('Deseja salvar o token em um arquivo? [s/N]: ')

  if (saveToken.toLowerCase() === 's' || saveToken.toLowerCase() === 'y') {
    const filename = `token_${userId}_${Date.now()}.txt`
    const filepath = path.join(__dirname, '..', filename)

    const content = `# Token JWT - NxZap
# Gerado em: ${new Date().toISOString()}
# User ID: ${userId}
# Email: ${email || 'N/A'}
# Role: ${role}
# Expira em: ${expiresIn}

TOKEN=${token}

# Como usar:
# Authorization: Bearer ${token}

# Teste:
# curl -H "Authorization: Bearer ${token}" http://localhost:8091/api/auth/test
`

    fs.writeFileSync(filepath, content)
    log(`\n✅ Token salvo em: ${colors.green}${filename}${colors.reset}`, colors.bright)
    log(`⚠️  IMPORTANTE: Adicione ${filename} ao .gitignore!`, colors.yellow)
  }

  log('\n🎉 Pronto! Use o token acima para autenticar nas APIs.\n', colors.green)

  rl.close()
}

// Executa
main().catch((error) => {
  log(`\n❌ Erro: ${error.message}`, colors.red)
  rl.close()
  process.exit(1)
})

