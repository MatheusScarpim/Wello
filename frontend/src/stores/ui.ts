import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(true)
  const sidebarCollapsed = ref(false)
  const isMobile = ref(window.innerWidth < 768)

  function toggleSidebar() {
    if (isMobile.value) {
      sidebarOpen.value = !sidebarOpen.value
    } else {
      sidebarCollapsed.value = !sidebarCollapsed.value
    }
  }

  function closeSidebar() {
    if (isMobile.value) {
      sidebarOpen.value = false
    }
  }

  function handleResize() {
    const wasMobile = isMobile.value
    isMobile.value = window.innerWidth < 768

    if (wasMobile && !isMobile.value) {
      sidebarOpen.value = true
    }
  }

  // Initialize resize listener
  window.addEventListener('resize', handleResize)

  return {
    sidebarOpen,
    sidebarCollapsed,
    isMobile,
    toggleSidebar,
    closeSidebar
  }
})
