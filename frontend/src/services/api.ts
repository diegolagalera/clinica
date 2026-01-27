import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

class ApiService {
    private client: AxiosInstance
    private isRefreshing = false
    private failedQueue: Array<{
        resolve: (token: string) => void
        reject: (error: Error) => void
    }> = []

    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'Content-Type': 'application/json',
            },
        })

        this.setupInterceptors()
    }

    private setupInterceptors() {
        // Request interceptor - add auth token
        this.client.interceptors.request.use(
            (config) => {
                const authStore = useAuthStore()

                if (authStore.accessToken) {
                    config.headers.Authorization = `Bearer ${authStore.accessToken}`
                }

                // Add clinic context header if available
                if (authStore.currentClinicId) {
                    config.headers['X-Clinic-Id'] = authStore.currentClinicId
                }

                if (authStore.currentOrganizationId) {
                    config.headers['X-Organization-Id'] = authStore.currentOrganizationId
                }

                return config
            },
            (error) => Promise.reject(error)
        )

        // Response interceptor - handle token refresh and account deactivation
        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }
                const errorData = error.response?.data as { code?: string; message?: string } | undefined

                // Handle account deactivation - immediate logout without retry
                if (error.response?.status === 401 && errorData?.code === 'ACCOUNT_DEACTIVATED') {
                    const authStore = useAuthStore()
                    // Clear auth data and redirect to login
                    authStore.logout()
                    return Promise.reject(new Error('Tu cuenta ha sido desactivada'))
                }

                if (error.response?.status === 401 && !originalRequest._retry) {
                    if (this.isRefreshing) {
                        return new Promise((resolve, reject) => {
                            this.failedQueue.push({ resolve, reject })
                        })
                            .then((token) => {
                                originalRequest.headers = originalRequest.headers || {}
                                originalRequest.headers.Authorization = `Bearer ${token}`
                                return this.client(originalRequest)
                            })
                            .catch((err) => Promise.reject(err))
                    }

                    originalRequest._retry = true
                    this.isRefreshing = true

                    try {
                        const authStore = useAuthStore()
                        await authStore.refreshToken()

                        const newToken = authStore.accessToken
                        this.processQueue(null, newToken!)

                        originalRequest.headers = originalRequest.headers || {}
                        originalRequest.headers.Authorization = `Bearer ${newToken}`
                        return this.client(originalRequest)
                    } catch (refreshError) {
                        this.processQueue(refreshError as Error, null)
                        const authStore = useAuthStore()
                        authStore.logout()
                        return Promise.reject(refreshError)
                    } finally {
                        this.isRefreshing = false
                    }
                }

                return Promise.reject(error)
            }
        )
    }

    private processQueue(error: Error | null, token: string | null) {
        this.failedQueue.forEach((prom) => {
            if (error) {
                prom.reject(error)
            } else {
                prom.resolve(token!)
            }
        })
        this.failedQueue = []
    }

    // HTTP methods
    async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.get<T>(url, config)
        return response.data
    }

    async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.post<T>(url, data, config)
        return response.data
    }

    async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.put<T>(url, data, config)
        return response.data
    }

    async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.patch<T>(url, data, config)
        return response.data
    }

    async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
        const response = await this.client.delete<T>(url, config)
        return response.data
    }

    // File upload
    async upload<T>(url: string, file: File, fieldName = 'file', additionalData?: Record<string, unknown>): Promise<T> {
        const formData = new FormData()
        formData.append(fieldName, file)

        if (additionalData) {
            Object.entries(additionalData).forEach(([key, value]) => {
                formData.append(key, String(value))
            })
        }

        const response = await this.client.post<T>(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    }

    // Post FormData directly
    async postFormData<T>(url: string, formData: FormData): Promise<T> {
        const response = await this.client.post<T>(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    }
}

export const api = new ApiService()
