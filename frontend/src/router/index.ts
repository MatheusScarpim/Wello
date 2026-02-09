import { createRouter, createWebHistory } from 'vue-router'

const decodeRoleFromToken = (token: string | null): string | null => {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(atob(base64))))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { title: 'Login', public: true }
    },
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/dashboard'
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: 'Dashboard', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'queue',
          name: 'queue',
          component: () => import('@/views/QueueView.vue'),
          meta: { title: 'Fila de Atendimento', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'assumir',
          name: 'assumir',
          component: () => import('@/views/AssumeView.vue'),
          meta: { title: 'Assumir Atendimento', roles: ['operator', 'admin', 'supervisor'] }
        },
        {
          path: 'conversations',
          name: 'conversations',
          component: () => import('@/views/ConversationsView.vue'),
          meta: { title: 'Conversas', roles: ['operator', 'admin', 'supervisor'] }
        },
        {
          path: 'contacts',
          name: 'contacts',
          component: () => import('@/views/ContactsView.vue'),
          meta: { title: 'Contatos', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'all-conversations',
          name: 'all-conversations',
          component: () => import('@/views/AllConversationsView.vue'),
          meta: { title: 'Todas as Conversas', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'conversations/:id',
          name: 'conversation-detail',
          component: () => import('@/views/ConversationDetailView.vue'),
          meta: { title: 'Detalhes da Conversa', roles: ['operator', 'admin', 'supervisor'] }
        },
        {
          path: 'departments',
          name: 'departments',
          component: () => import('@/views/DepartmentsView.vue'),
          meta: { title: 'Departamentos', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'operators',
          name: 'operators',
          component: () => import('@/views/OperatorsView.vue'),
          meta: { title: 'Operadores', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'bots',
          name: 'bots',
          component: () => import('@/views/BotsView.vue'),
          meta: { title: 'Bots', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'webhooks',
          name: 'webhooks',
          component: () => import('@/views/WebhooksView.vue'),
          meta: { title: 'Webhooks', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'storage',
          name: 'storage',
          component: () => import('@/views/StorageView.vue'),
          meta: { title: 'Storage', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('@/views/ExpensesView.vue'),
          meta: { title: 'Despesas', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
          meta: { title: 'Configurações', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'whitelabel',
          name: 'whitelabel',
          component: () => import('@/views/WhitelabelView.vue'),
          meta: { title: 'Personalização', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'finalizations',
          name: 'finalizations',
          component: () => import('@/views/FinalizationsView.vue'),
          meta: { title: 'Finalizações', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'tags',
          name: 'tags',
          component: () => import('@/views/TagsView.vue'),
          meta: { title: 'Tags', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'finalization-metrics',
          name: 'finalization-metrics',
          component: () => import('@/views/FinalizationMetricsView.vue'),
          meta: { title: 'Métricas de Finalizações', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'metricas',
          name: 'metrics',
          component: () => import('@/views/MetricsView.vue'),
          meta: { title: 'Métricas', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'ia',
          name: 'ia',
          component: () => import('@/views/IAView.vue'),
          meta: { title: 'Assistente IA', roles: ['admin', 'supervisor'] }
        },
        {
          path: 'whatsapp',
          name: 'whatsapp',
          component: () => import('@/views/WhatsAppView.vue'),
          meta: { title: 'Instancias', roles: ['admin', 'supervisor'] }
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const isPublic = Boolean(to.meta.public)
  const token = localStorage.getItem('auth_token')
  const role = decodeRoleFromToken(token)

  if (!isPublic && !token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.meta.roles && role && !to.meta.roles.includes(role)) {
    return next(role === 'operator' ? '/assumir' : '/dashboard')
  }

  if (to.path === '/login' && token) {
    return next((to.query.redirect as string) || '/dashboard')
  }

  document.title = `${to.meta.title || 'welloChat'} - Painel de Atendimento`
  next()
})

export default router


