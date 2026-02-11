// User roles
export enum Role {
    SUPERADMIN = 'SUPERADMIN',
    ADMIN = 'ADMIN',
    WORKER = 'WORKER',
    USER = 'USER',
}

// User interface
export interface User {
    id: string
    email: string
    firstName: string
    lastName: string
    phone?: string
    avatarUrl?: string
    role: Role
    organizationId: string | null
    clinicId: string | null
    twoFactorEnabled: boolean
    emailVerified: boolean
    lastLoginAt?: string
    createdAt: string
}

// Auth tokens
export interface AuthTokens {
    accessToken: string
    refreshToken: string
    expiresIn: number
}

// Login response
export interface LoginResponse {
    tokens: AuthTokens
    user: User
    requires2FA?: boolean
}

// Organization
export interface Organization {
    id: string
    name: string
    slug: string
    email?: string
    phone?: string
    address?: string
    logoUrl?: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

// Module Permissions
export type ModulePermission = 'whatsapp' | 'ratings' | 'marketing' | 'staff' | 'settings' | 'stock'

// Clinic
export interface Clinic {
    id: string
    organizationId: string
    name: string
    slug: string
    email?: string
    phone?: string
    address?: string
    city?: string
    postalCode?: string
    country: string
    timezone: string
    isActive: boolean
    aiEnabled?: boolean
    aiMonthlyTokenLimit?: number
    permissions?: ModulePermission[]
    createdAt: string
    updatedAt: string
}

// Patient
export interface Patient {
    id: string
    clinicId: string
    userId?: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
    dateOfBirth?: string
    gender?: string
    idNumber?: string
    address?: string
    city?: string
    postalCode?: string
    emergencyContact?: string
    emergencyPhone?: string
    allergies?: string
    medicalHistory?: string
    notes?: string
    insuranceProvider?: string
    insuranceNumber?: string
    consentGiven: boolean
    consentDate?: string
    whatsappAvailable?: boolean | null
    isActive: boolean
    createdAt: string
    updatedAt: string
}

// Appointment types
export enum AppointmentType {
    VISIT = 'VISIT',
    SURGERY = 'SURGERY',
    REVIEW = 'REVIEW',
    EMERGENCY = 'EMERGENCY',
    FOLLOWUP = 'FOLLOWUP',
}

export enum AppointmentStatus {
    SCHEDULED = 'SCHEDULED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW',
}

// Appointment Worker (junction table record)
export interface AppointmentWorker {
    id: string
    appointmentId: string
    userId: string
    isPrimary: boolean
    user?: User
    createdAt: string
}

// Appointment
export interface Appointment {
    id: string
    clinicId: string
    patientId: string
    workerId?: string | null  // Legacy, may be null
    type: AppointmentType
    status: AppointmentStatus
    title?: string
    description?: string
    startTime: string
    endTime: string
    duration: number
    notes?: string
    // Real time tracking fields
    realStartTime?: string | null
    realEndTime?: string | null
    pausedDuration?: number | null
    startedById?: string | null
    // Relations
    patient?: Patient
    worker?: User  // Legacy primary worker
    appointmentWorkers?: AppointmentWorker[]  // All assigned workers
    // Notification tracking
    waNotificationSentAt?: string | null
    createdAt: string
    updatedAt: string
}

// Clinical Record
export interface ClinicalRecord {
    id: string
    clinicId: string
    patientId: string
    appointmentId?: string
    createdById: string
    recordType: string
    title?: string
    content?: string
    vitalSigns?: VitalSigns
    procedures?: Procedure[]
    diagnosis?: string
    treatment?: string
    prescriptions?: Prescription[]
    isSigned: boolean
    signedAt?: string
    createdAt: string
    updatedAt: string
}

export interface VitalSigns {
    bloodPressure?: string
    heartRate?: number
    temperature?: number
    weight?: number
    height?: number
}

export interface Procedure {
    code: string
    name: string
    toothNumbers?: number[]
    notes?: string
    cost?: number
}

export interface Prescription {
    medication: string
    dosage: string
    frequency: string
    duration: string
    notes?: string
}

// Radiograph
export interface Radiograph {
    id: string
    clinicId: string
    patientId: string
    clinicalRecordId?: string
    uploadedById: string
    filename: string
    originalFilename: string
    mimeType: string
    fileSize: number
    storageKey: string
    radiographType?: string
    toothNumbers?: number[]
    notes?: string
    annotations?: Annotation[]
    aiResult?: RadiographAIResult | null
    uploadedBy?: {
        firstName: string
        lastName: string
    }
    createdAt: string
    updatedAt: string
}

export interface Annotation {
    id: string
    type: string
    x: number
    y: number
    width?: number
    height?: number
    text?: string
}

// AI Analysis
export enum AIAnalysisStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REVIEWED = 'REVIEWED',
    REJECTED = 'REJECTED',
}

export interface RadiographAIResult {
    id: string
    radiographId: string
    status: AIAnalysisStatus
    modelVersion?: string
    processingTimeMs?: number
    suspiciousAreas: SuspiciousArea[]
    summary?: string
    confidence?: number
    reviewedById?: string
    reviewedAt?: string
    reviewNotes?: string
    isAccepted?: boolean
    errorMessage?: string
    createdAt: string
    updatedAt: string
}

export interface SuspiciousArea {
    id?: string
    // New OpenAI format
    area?: string
    finding?: string
    severity?: 'LOW' | 'MEDIUM' | 'HIGH'
    // Legacy format
    type?: 'caries' | 'lesion' | 'bone_loss' | 'fracture' | 'other'
    location?: {
        x: number
        y: number
        width: number
        height: number
    }
    confidence?: number
    description: string
    toothNumber?: number
}

// Inventory
export interface InventoryItem {
    id: string
    clinicId: string
    sku?: string
    name: string
    description?: string
    category?: string
    unit: string
    currentStock: number
    minStock: number
    maxStock?: number
    costPrice?: number
    sellPrice?: number
    supplier?: string
    expirationDate?: string
    location?: string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

// Invoice
export enum InvoiceStatus {
    DRAFT = 'DRAFT',
    SENT = 'SENT',
    PAID = 'PAID',
    PARTIAL = 'PARTIAL',
    OVERDUE = 'OVERDUE',
    CANCELLED = 'CANCELLED',
}

export interface Invoice {
    id: string
    clinicId: string
    patientId: string
    invoiceNumber: string
    status: InvoiceStatus
    issueDate: string
    dueDate?: string
    subtotal: number
    taxRate: number
    taxAmount: number
    discount: number
    total: number
    paidAmount: number
    items: InvoiceItem[]
    notes?: string
    patient?: Patient
    createdAt: string
    updatedAt: string
}

export interface InvoiceItem {
    description: string
    quantity: number
    unitPrice: number
    total: number
}

// API Response types
export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    message?: string
    errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

// Dashboard Stats
export interface DashboardStats {
    patientsCount: number
    appointmentsToday: number
    appointmentsWeek: number
    revenueMonth: number
    pendingPayments: number
    lowStockItems: number
}

// Odontogram
export type DentalCondition =
    | 'HEALTHY'
    | 'CARIES'
    | 'FILLING'
    | 'CROWN'
    | 'EXTRACTION_INDICATED'
    | 'MISSING'
    | 'IMPLANT'
    | 'ROOT_CANAL'
    | 'FRACTURE'
    | 'BRIDGE'
    | 'VENEER'
    | 'SEALANT'

export interface ToothSurfaces {
    mesial: DentalCondition
    distal: DentalCondition
    occlusal: DentalCondition
    vestibular: DentalCondition
    palatino: DentalCondition
}

export interface OdontogramTooth {
    id: string
    odontogramId: string
    toothNumber: number
    generalCondition: DentalCondition
    surfaces: ToothSurfaces
    notes: string | null
    createdAt: string
    updatedAt: string
}

export interface Odontogram {
    id: string
    clinicId: string
    patientId: string
    isChild: boolean
    notes: string | null
    lastUpdatedById: string | null
    createdAt: string
    updatedAt: string
    teeth?: OdontogramTooth[]
}

export interface OdontogramHistoryEntry {
    id: string
    toothNumber: number
    surface: string | null
    previousCondition: string | null
    newCondition: string
    changedById: string
    notes: string | null
    createdAt: string
}

export interface OdontogramSnapshot {
    id: string
    odontogramId: string
    name: string
    description: string | null
    teethState: OdontogramTooth[]
    createdById: string
    createdAt: string
}
