import axios, { type AxiosInstance, type AxiosError } from 'axios'
import type { ApiResponse, ApiError } from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL || ''

class ApiClient {
  private instance: AxiosInstance
  private token: string | null = null

  constructor() {
    this.instance = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor
    this.instance.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        const message = error.response?.data?.error || error.message || 'Erro desconhecido'
        console.error('API Error:', message)

        // Handle 401 - clear token and redirect to login
        if (error.response?.status === 401) {
          this.setToken(null)
          // Avoid redirect loop if already on login page
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        }

        return Promise.reject(error)
      }
    )

    // Load token from localStorage
    const savedToken = localStorage.getItem('auth_token')
    if (savedToken) {
      this.token = savedToken
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  getToken() {
    return this.token
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, { params })
    return response.data
  }

  async post<T>(url: string, data?: unknown, config?: { timeout?: number }): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data)
    return response.data
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(url, data)
    return response.data
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url)
    return response.data
  }

  async upload<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async download(url: string): Promise<Blob> {
    const response = await this.instance.get(url, {
      responseType: 'blob',
    })
    return response.data
  }
}

export const apiClient = new ApiClient()
export default apiClient
