import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'
import type { User, AuthTokens, LoginResponse, Role, ApiResponse, Clinic, Organization, ModulePermission } from '@/types'
import router from '@/router'

const ACCESS_TOKEN_KEY = 'dental_erp_access_token'
const REFRESH_TOKEN_KEY = 'dental_erp_refresh_token'
const USER_KEY = 'dental_erp_user'
const CURRENT_CLINIC_KEY = 'dental_erp_current_clinic'
const CURRENT_ORG_KEY = 'dental_erp_current_org'
const TENANT_SLUG_KEY = 'dental_erp_tenant_slug'

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref<User | null>(null)
    const accessToken = ref<string | null>(null)
    const refreshTokenValue = ref<string | null>(null)
    const currentClinicId = ref<string | null>(null)
    const currentOrganizationId = ref<string | null>(null)
    const availableClinics = ref<Clinic[]>([])
    const currentOrganization = ref<Organization | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    let _permissionsPromise: Promise<void> | null = null
    const requires2FA = ref(false)
    const tempEmail = ref<string | null>(null)
    const tempPassword = ref<string | null>(null)

    // Multi-tenant state (tenantSlug now primarily from subdomain, stored for SuperAdmin)
    const tenantSlug = ref<string | null>(null)

    // Getters
    const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
    const isAdmin = computed(() => user.value?.role === 'ADMIN' || user.value?.role === 'SUPERADMIN')
    const isSuperAdmin = computed(() => user.value?.role === 'SUPERADMIN')
    const isWorker = computed(() => user.value?.role === 'WORKER')
    const isPatient = computed(() => user.value?.role === 'USER')
    const userRole = computed(() => user.value?.role)
    const fullName = computed(() => user.value ? `${user.value.firstName} ${user.value.lastName}` : '')
    const currentClinic = computed(() => availableClinics.value.find(c => c.id === currentClinicId.value))

    // Initialize from localStorage
    const init = () => {
        const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY)
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
        const storedUser = localStorage.getItem(USER_KEY)
        const storedClinic = localStorage.getItem(CURRENT_CLINIC_KEY)
        const storedOrg = localStorage.getItem(CURRENT_ORG_KEY)
        const storedTenant = localStorage.getItem(TENANT_SLUG_KEY)

        if (storedToken) accessToken.value = storedToken
        if (storedRefreshToken) refreshTokenValue.value = storedRefreshToken
        if (storedUser) user.value = JSON.parse(storedUser)
        if (storedClinic) currentClinicId.value = storedClinic
        if (storedOrg) currentOrganizationId.value = storedOrg
        if (storedTenant) tenantSlug.value = storedTenant
    }

    // Persist current user to localStorage
    const persistUser = () => {
        if (user.value) {
            localStorage.setItem(USER_KEY, JSON.stringify(user.value))
        }
    }

    // Fetch fresh user data from server and update store + localStorage
    const fetchMe = async () => {
        try {
            const res = await api.get<ApiResponse<User>>('/auth/me')
            if (res.success && res.data && user.value) {
                user.value.firstName = res.data.firstName
                user.value.lastName = res.data.lastName
                user.value.phone = res.data.phone
                user.value.email = res.data.email
                persistUser()
            }
        } catch {
            // Non-blocking — keep cached data on failure
        }
    }

    // Actions
    const login = async (email: string, password: string, twoFactorCode?: string) => {
        isLoading.value = true
        error.value = null
        requires2FA.value = false

        try {
            // Subdomain slug is injected via X-Tenant-Slug header in api.ts
            const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
                email,
                password,
                twoFactorCode,
            })

            if (response.success && response.data) {
                if (response.data.requires2FA) {
                    requires2FA.value = true
                    tempEmail.value = email
                    tempPassword.value = password
                    return { requires2FA: true }
                }

                // Store tenant slug from the login response (for SuperAdmin managing tenants)
                if (response.data.user.tenantSlug) {
                    setTenantSlug(response.data.user.tenantSlug)
                }

                setAuthData(response.data.tokens, response.data.user)
                await loadUserContext()
                return { success: true }
            } else {
                throw new Error(response.message || 'Login failed')
            }
        } catch (err: any) {
            error.value = err.response?.data?.message || err.message || 'Login failed'
            throw err
        } finally {
            isLoading.value = false
        }
    }



    const verify2FA = async (code: string) => {
        if (!tempEmail.value || !tempPassword.value) {
            throw new Error('No pending 2FA verification')
        }
        return login(tempEmail.value, tempPassword.value, code)
    }

    const register = async (data: {
        email: string
        password: string
        firstName: string
        lastName: string
        phone?: string
    }) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await api.post<ApiResponse<{ user: User }>>('/auth/register', data)

            if (response.success) {
                return { success: true, message: response.message }
            } else {
                throw new Error(response.message || 'Registration failed')
            }
        } catch (err: any) {
            error.value = err.response?.data?.message || err.message || 'Registration failed'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    const refreshToken = async () => {
        if (!refreshTokenValue.value) {
            throw new Error('No refresh token available')
        }

        try {
            const response = await api.post<ApiResponse<AuthTokens>>('/auth/refresh', {
                refreshToken: refreshTokenValue.value,
            })

            if (response.success && response.data) {
                accessToken.value = response.data.accessToken
                refreshTokenValue.value = response.data.refreshToken
                localStorage.setItem(ACCESS_TOKEN_KEY, response.data.accessToken)
                localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken)
            } else {
                throw new Error('Token refresh failed')
            }
        } catch (err) {
            logout()
            throw err
        }
    }

    let _isLoggingOut = false
    const logout = async () => {
        // Guard against recursive logout calls (interceptor → logout → /auth/logout 401 → interceptor → logout...)
        if (_isLoggingOut) return
        _isLoggingOut = true

        try {
            if (accessToken.value && refreshTokenValue.value) {
                // Best-effort server-side revocation — use _silentError to prevent toast
                await api.post('/auth/logout', { refreshToken: refreshTokenValue.value }, {
                    _silentError: true,
                    _retry: true, // prevent interceptor from retrying this request
                } as any)
            }
        } catch {
            // Ignore errors during logout — token will expire naturally
        } finally {
            clearAuthData()
            router.push('/login')
            _isLoggingOut = false
        }
    }

    const setAuthData = (tokens: AuthTokens, userData: User) => {
        accessToken.value = tokens.accessToken
        refreshTokenValue.value = tokens.refreshToken
        user.value = userData
        currentOrganizationId.value = userData.organizationId
        currentClinicId.value = userData.clinicId

        localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify(userData))
        if (userData.organizationId) {
            localStorage.setItem(CURRENT_ORG_KEY, userData.organizationId)
        }
        if (userData.clinicId) {
            localStorage.setItem(CURRENT_CLINIC_KEY, userData.clinicId)
        }
    }

    const setTenantSlug = (slug: string) => {
        tenantSlug.value = slug || null
        if (slug) {
            localStorage.setItem(TENANT_SLUG_KEY, slug)
        } else {
            localStorage.removeItem(TENANT_SLUG_KEY)
        }
    }

    const clearAuthData = () => {
        accessToken.value = null
        refreshTokenValue.value = null
        user.value = null
        currentClinicId.value = null
        currentOrganizationId.value = null
        availableClinics.value = []
        currentOrganization.value = null
        requires2FA.value = false
        tempEmail.value = null
        tempPassword.value = null
        tenantSlug.value = null

        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(CURRENT_CLINIC_KEY)
        localStorage.removeItem(CURRENT_ORG_KEY)
        localStorage.removeItem(TENANT_SLUG_KEY)
    }

    const loadUserContext = async () => {
        if (!user.value) return

        // SUPERADMIN operates at platform level — no tenant clinics to load
        if (user.value.role === 'SUPERADMIN') return

        // Load available clinics based on role
        if (user.value.role === 'ADMIN' || user.value.role === 'WORKER') {
            try {
                const response = await api.get<ApiResponse<Clinic[]>>('/staff/my-clinics')
                if (response.success && response.data) {
                    availableClinics.value = response.data

                    // If no clinic selected and there are available clinics, select the first one
                    if (!currentClinicId.value && response.data.length > 0) {
                        selectClinic(response.data[0]!.id)
                    }
                    // Verify current clinic is still valid
                    else if (currentClinicId.value && !response.data.find(c => c.id === currentClinicId.value)) {
                        if (response.data.length > 0) {
                            selectClinic(response.data[0]!.id)
                        } else {
                            currentClinicId.value = null
                            localStorage.removeItem(CURRENT_CLINIC_KEY)
                        }
                    }
                }
            } catch {
                // Handle error - might not have access to this endpoint
            }
        }
    }

    const selectClinic = (clinicId: string) => {
        currentClinicId.value = clinicId
        localStorage.setItem(CURRENT_CLINIC_KEY, clinicId)
    }

    const selectOrganization = (orgId: string) => {
        currentOrganizationId.value = orgId
        localStorage.setItem(CURRENT_ORG_KEY, orgId)
    }

    const hasRole = (...roles: Role[]): boolean => {
        if (!user.value) return false
        return roles.includes(user.value.role)
    }

    const canAccess = (requiredRoles: Role[]): boolean => {
        return hasRole(...requiredRoles)
    }

    const hasPermission = (permission: ModulePermission): boolean => {
        if (!user.value) return false
        // ADMIN and SUPERADMIN always have full access
        if (user.value.role === 'ADMIN' || user.value.role === 'SUPERADMIN') return true
        // For WORKER, check current clinic's permissions
        const clinic = currentClinic.value
        if (!clinic?.permissions) return false
        return clinic.permissions.includes(permission)
    }

    // Ensure permissions have been loaded (for route guard)
    const ensurePermissionsLoaded = (): Promise<void> => {
        if (!user.value) return Promise.resolve()
        if (availableClinics.value.length > 0) return Promise.resolve()
        if (_permissionsPromise) return _permissionsPromise
        _permissionsPromise = loadUserContext()
        return _permissionsPromise
    }

    // Initialize on store creation
    init()

    // Eagerly start loading permissions if authenticated
    if (user.value) {
        _permissionsPromise = loadUserContext()
        // Refresh user data from server in background
        fetchMe()
    }

    return {
        // State
        user,
        accessToken,
        currentClinicId,
        currentOrganizationId,
        availableClinics,
        currentOrganization,
        isLoading,
        error,
        requires2FA,
        tenantSlug,

        // Getters
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
        isWorker,
        isPatient,
        userRole,
        fullName,
        currentClinic,

        // Actions
        login,
        verify2FA,
        register,
        refreshToken,
        logout,
        loadUserContext,
        selectClinic,
        selectOrganization,
        hasRole,
        canAccess,
        hasPermission,
        ensurePermissionsLoaded,
        setTenantSlug,
        persistUser,
        fetchMe,
    }
})
