/**
 * welloChat - Sistema de Automação WhatsApp
 * Versão 2.0 - Arquitetura Completamente Refatorada
 *
 * @author Pedro Kayami & Matheus Scarpim
 * @version 2.0.0
 */

// import '@/assets/Host/HostExpress.js' // Arquivo não existe - comentado
import * as dotenv from 'dotenv'

import Application from '@/core/Application'

// Carrega variáveis de ambiente
dotenv.config()

/**
 * Função principal de inicialização
 */
async function bootstrap(): Promise<void> {
  try {
    console.log('╔════════════════════════════════════════╗')
    console.log('║                                        ║')
    console.log('║           🚀 welloChat v2.0 🚀             ║')
    console.log('║     Sistema de Automação WhatsApp      ║')
    console.log('║                                        ║')
    console.log('╚════════════════════════════════════════╝')
    console.log('')

    // Inicializa a aplicação
    await Application.initialize()

    console.log('')
    console.log('╔════════════════════════════════════════╗')
    console.log('║    ✅ Sistema iniciado com sucesso    ║')
    console.log('╚════════════════════════════════════════╝')
    console.log('')

    // Exibe status
    const status = Application.getStatus()
    console.log('📊 Status do Sistema:')
    console.log(
      `   🗄️  Banco de Dados: ${status.database ? '✅ Conectado' : '❌ Desconectado'}`,
    )
    console.log(
      `   📱 WhatsApp: ${status.whatsapp ? '✅ Conectado' : '❌ Desconectado'}`,
    )
    console.log(`   🤖 Bots Ativos: ${status.bots.length}`)
    if (status.bots.length > 0) {
      status.bots.forEach((bot) => console.log(`      - ${bot}`))
    }
    console.log('')
  } catch (error) {
    console.error('❌ Erro fatal ao iniciar aplicação:', error)
    process.exit(1)
  }
}

/**
 * Handlers de sinais para encerramento gracioso
 */
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Recebido sinal de interrupção (SIGINT)')
  await gracefulShutdown()
})

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Recebido sinal de término (SIGTERM)')
  await gracefulShutdown()
})

/**
 * Handler de erros não capturados
 */
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error)
  gracefulShutdown().then(() => process.exit(1))
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise não tratada:', promise, 'Razão:', reason)
  gracefulShutdown().then(() => process.exit(1))
})

/**
 * Encerra a aplicação de forma graciosa
 */
async function gracefulShutdown(): Promise<void> {
  try {
    console.log('\n🛑 Iniciando encerramento gracioso...')
    await Application.shutdown()
    console.log('✅ Aplicação encerrada com sucesso')
    process.exit(0)
  } catch (error) {
    console.error('❌ Erro durante encerramento:', error)
    process.exit(1)
  }
}

/**
 * Inicia a aplicação
 */
bootstrap()
