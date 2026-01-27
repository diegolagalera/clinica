import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Role } from '@/types'

// Lazy-loaded components
const Login = () => import('@/pages/auth/Login.vue')
const Register = () => import('@/pages/auth/Register.vue')
const ForgotPassword = () => import('@/pages/auth/ForgotPassword.vue')
const ResetPassword = () => import('@/pages/auth/ResetPassword.vue')

// Layouts
const AuthLayout = () => import('@/layouts/AuthLayout.vue')
const SuperAdminLayout = () => import('@/layouts/SuperAdminLayout.vue')
const ClinicLayout = () => import('@/layouts/ClinicLayout.vue')
const PatientLayout = () => import('@/layouts/PatientLayout.vue')

// Super Admin pages
const SADashboard = () => import('@/pages/super-admin/Dashboard.vue')
const SAOrganizations = () => import('@/pages/super-admin/Organizations.vue')
const SAOrganizationDetail = () => import('@/pages/super-admin/OrganizationDetail.vue')
const SAClinics = () => import('@/pages/super-admin/Clinics.vue')
const SAUsers = () => import('@/pages/super-admin/Users.vue')

// Clinic pages (Admin/Worker)
const ClinicDashboard = () => import('@/pages/clinic/Dashboard.vue')
const ClinicStaff = () => import('@/pages/clinic/Staff.vue')
const ClinicPatients = () => import('@/pages/clinic/Patients.vue')
const ClinicPatientDetail = () => import('@/pages/clinic/PatientDetail.vue')
const ClinicCalendar = () => import('@/pages/clinic/Calendar.vue')
const ClinicRecords = () => import('@/pages/clinic/Records.vue')
const ClinicRadiographs = () => import('@/pages/clinic/Radiographs.vue')
const ClinicInventory = () => import('@/pages/clinic/Inventory.vue')
const ClinicInvoices = () => import('@/pages/clinic/Invoices.vue')
const ClinicNotifications = () => import('@/pages/clinic/Notifications.vue')
const ClinicTemplateEditor = () => import('@/pages/clinic/TemplateEditor.vue')
const ClinicSmsConfig = () => import('@/pages/clinic/SmsConfig.vue')
const ClinicSettings = () => import('@/pages/clinic/Settings.vue')
const ClinicRatings = () => import('@/pages/clinic/Ratings.vue')
const OdontogramFullscreen = () => import('@/pages/clinic/OdontogramFullscreen.vue')

// Patient pages
const PatientDashboard = () => import('@/pages/patient/Dashboard.vue')
const PatientAppointments = () => import('@/pages/patient/Appointments.vue')
const PatientRecords = () => import('@/pages/patient/Records.vue')
const PatientInvoices = () => import('@/pages/patient/Invoices.vue')
const PatientProfile = () => import('@/pages/patient/Profile.vue')

// Public pages (no auth required)
const RateVisit = () => import('@/pages/public/RateVisit.vue')

const routes: RouteRecordRaw[] = [
    // Auth routes
    {
        path: '/',
        component: AuthLayout,
        meta: { requiresGuest: true },
        children: [
            { path: '', redirect: '/login' },
            { path: 'login', name: 'login', component: Login },
            { path: 'register', name: 'register', component: Register },
            { path: 'forgot-password', name: 'forgot-password', component: ForgotPassword },
            { path: 'reset-password/:token', name: 'reset-password', component: ResetPassword },
        ],
    },

    // Super Admin routes
    {
        path: '/admin',
        component: SuperAdminLayout,
        meta: { requiresAuth: true, roles: [Role.SUPERADMIN] },
        children: [
            { path: '', redirect: '/admin/dashboard' },
            { path: 'dashboard', name: 'admin-dashboard', component: SADashboard },
            { path: 'organizations', name: 'admin-organizations', component: SAOrganizations },
            { path: 'organizations/:id', name: 'admin-organization-detail', component: SAOrganizationDetail },
            { path: 'clinics', name: 'admin-clinics', component: SAClinics },
            { path: 'users', name: 'admin-users', component: SAUsers },
        ],
    },

    // Clinic routes (Admin/Worker)
    {
        path: '/clinic',
        component: ClinicLayout,
        meta: { requiresAuth: true, roles: [Role.ADMIN, Role.WORKER] },
        children: [
            { path: '', redirect: '/clinic/dashboard' },
            { path: 'dashboard', name: 'clinic-dashboard', component: ClinicDashboard },
            {
                path: 'staff',
                name: 'clinic-staff',
                component: ClinicStaff,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
            { path: 'patients', name: 'clinic-patients', component: ClinicPatients },
            { path: 'patients/:id', name: 'clinic-patient-detail', component: ClinicPatientDetail },
            { path: 'calendar', name: 'clinic-calendar', component: ClinicCalendar },
            { path: 'records', name: 'clinic-records', component: ClinicRecords },
            { path: 'radiographs', name: 'clinic-radiographs', component: ClinicRadiographs },
            { path: 'inventory', name: 'clinic-inventory', component: ClinicInventory },
            {
                path: 'invoices',
                name: 'clinic-invoices',
                component: ClinicInvoices,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
            {
                path: 'notifications',
                name: 'clinic-notifications',
                component: ClinicNotifications,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
            {
                path: 'notifications/editor/:id?',
                name: 'clinic-template-editor',
                component: ClinicTemplateEditor,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
            {
                path: 'sms',
                name: 'clinic-sms',
                component: ClinicSmsConfig,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
            {
                path: 'settings',
                name: 'clinic-settings',
                component: ClinicSettings,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
            {
                path: 'ratings',
                name: 'clinic-ratings',
                component: ClinicRatings,
                meta: { roles: [Role.ADMIN] } // Only Admin
            },
        ],
    },

    // Odontogram Fullscreen (standalone, no layout)
    {
        path: '/clinic/odontogram/:patientId',
        name: 'clinic-odontogram-fullscreen',
        component: OdontogramFullscreen,
        meta: { requiresAuth: true, roles: [Role.ADMIN, Role.WORKER] },
    },

    // Patient routes
    {
        path: '/patient',
        component: PatientLayout,
        meta: { requiresAuth: true, roles: [Role.USER] },
        children: [
            { path: '', redirect: '/patient/dashboard' },
            { path: 'dashboard', name: 'patient-dashboard', component: PatientDashboard },
            { path: 'appointments', name: 'patient-appointments', component: PatientAppointments },
            { path: 'records', name: 'patient-records', component: PatientRecords },
            { path: 'invoices', name: 'patient-invoices', component: PatientInvoices },
            { path: 'profile', name: 'patient-profile', component: PatientProfile },
        ],
    },

    // Public routes (no auth required)
    {
        path: '/rate/:token',
        name: 'rate-visit',
        component: RateVisit,
        meta: { isPublic: true },
    },

    // Catch all - 404
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFound.vue'),
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(_to, _from, savedPosition) {
        if (savedPosition) {
            return savedPosition
        }
        return { top: 0 }
    },
})

// Navigation guards
router.beforeEach((to, _from, next) => {
    // Skip auth checks for public routes
    if (to.matched.some(record => record.meta.isPublic)) {
        return next()
    }

    const authStore = useAuthStore()
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const requiresGuest = to.matched.some(record => record.meta.requiresGuest)
    const requiredRoles = to.matched.reduce((roles, record) => {
        if (record.meta.roles) {
            return record.meta.roles as Role[]
        }
        return roles
    }, [] as Role[])

    // Redirect authenticated users away from guest pages
    if (requiresGuest && authStore.isAuthenticated) {
        const redirectPath = getHomeRouteForRole(authStore.userRole!)
        return next(redirectPath)
    }

    // Redirect unauthenticated users to login
    if (requiresAuth && !authStore.isAuthenticated) {
        return next({ name: 'login', query: { redirect: to.fullPath } })
    }

    // Check role-based access
    if (requiredRoles.length > 0 && !authStore.canAccess(requiredRoles)) {
        const redirectPath = getHomeRouteForRole(authStore.userRole!)
        return next(redirectPath)
    }

    next()
})

// Helper to get home route based on role
function getHomeRouteForRole(role: Role): string {
    switch (role) {
        case Role.SUPERADMIN:
            return '/admin/dashboard'
        case Role.ADMIN:
        case Role.WORKER:
            return '/clinic/dashboard'
        case Role.USER:
            return '/patient/dashboard'
        default:
            return '/login'
    }
}

export default router
export { getHomeRouteForRole }
