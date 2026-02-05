import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast, { type PluginOptions, POSITION } from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { connectSocket } from './services/socket'
import { initMessageNotifications } from './services/notifications'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const app = createApp(App)

const toastOptions: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 4000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false
}

const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(Toast, toastOptions)

// Initialize whitelabel settings before mounting
import { useWhitelabelStore } from './stores/whitelabel'
const whitelabelStore = useWhitelabelStore()
whitelabelStore.fetchSettings().finally(() => {
  app.mount('#app')
  connectSocket(localStorage.getItem('auth_token'))
  initMessageNotifications(router)
})
