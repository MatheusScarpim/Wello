import { Router } from 'express'

import { IaController } from '../controllers/IaController'

const router = Router()
const controller = new IaController()

/**
 * Rotas de IA (Inteligencia Artificial)
 */

// Busca descricao da empresa
router.get('/company-description', controller.getCompanyDescription)

// Salva descricao da empresa
router.post('/company-description', controller.saveCompanyDescription)

// Busca instrucoes de sugestoes
router.get('/suggestion-instructions', controller.getSuggestionInstructions)

// Salva instrucoes de sugestoes
router.post('/suggestion-instructions', controller.saveSuggestionInstructions)

// Gera sugestao de resposta
router.post('/suggestion', controller.getSuggestion)

// Melhora mensagem antes de enviar
router.post('/improve-message', controller.improveMessage)

// Busca configuracoes da IA
router.get('/config', controller.getConfig)

// Atualiza configuracoes da IA
router.put('/config', controller.saveConfig)

export default router
