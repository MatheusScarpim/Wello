<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { useOperatorStore } from '@/stores/operator'
import { useWhitelabelStore } from '@/stores/whitelabel'

const authStore = useAuthStore()
const operatorStore = useOperatorStore()
const whitelabelStore = useWhitelabelStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)

const loginBackground = computed(() => whitelabelStore.loginBackground)
const companyName = computed(() => whitelabelStore.companyName || 'Wello')

onMounted(async () => {
  await whitelabelStore.fetchSettings()
})

const handleSubmit = async () => {
  if (!email.value || !password.value) {
    toast.error('Preencha o e-mail e a senha.')
    return
  }

  isSubmitting.value = true
  try {
    const data = await authStore.login({
      email: email.value.trim(),
      password: password.value,
      remember: true
    })

    operatorStore.setCurrentOperator(data.operator ?? null)

    const redirect = (route.query.redirect as string) || '/dashboard'
    await router.push(redirect)
  } catch (error: any) {
    const message = error?.response?.data?.error || error?.message || 'Falha ao entrar.'
    toast.error(message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900">
    <!-- Imagem de fundo da Personalização -->
    <div
      v-if="loginBackground"
      class="absolute inset-0 bg-cover bg-center bg-no-repeat"
      :style="{ backgroundImage: `url(${loginBackground})` }"
    >
      <div class="absolute inset-0 bg-black/50"></div>
    </div>
    <!-- Fallback quando não há imagem -->
    <div v-else class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>

    <!-- Formulário de Login -->
    <div class="relative z-10 w-full max-w-sm mx-4">
      <form
        class="rounded-2xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-md"
        @submit.prevent="handleSubmit"
      >
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-white">{{ companyName }}</h1>
          <p class="text-sm text-white/60 mt-2">Entre com suas credenciais</p>
        </div>

        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-white/80 mb-2" for="login-email">
              E-mail
            </label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="seu@email.com"
              class="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-white/80 mb-2" for="login-password">
              Senha
            </label>
            <div class="relative">
              <input
                id="login-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="********"
                class="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-16 text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs text-white/70 hover:bg-white/10 transition"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          class="w-full mt-8 rounded-xl bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="isSubmitting || authStore.isLoading"
        >
          <span v-if="!isSubmitting">Entrar</span>
          <span v-else>Entrando...</span>
        </button>
      </form>
    </div>
  </div>
</template>
