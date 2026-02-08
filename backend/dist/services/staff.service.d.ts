/**
 * Get staff members for an organization (all clinics)
 * Excludes USER role (patients)
 */
export declare const getStaffByOrganization: (organizationId: string) => Promise<{
    role: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER";
    id: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string | null;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    clinicId: string | null;
    emailVerified: boolean;
    emailVerificationToken: string | null;
    passwordResetToken: string | null;
    passwordResetExpires: Date | null;
    twoFactorEnabled: boolean;
    tokenVersion: number;
    lastLoginAt: Date | null;
    staffProfile: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        licenseNumber: string | null;
        specialty: string | null;
        bio: string | null;
        color: string | null;
        workingDays: unknown;
    } | null;
    workerClinics: {
        role: string | null;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        clinicId: string;
        userId: string;
        clinic: {
            name: string;
            id: string;
            slug: string;
            email: string | null;
            phone: string | null;
            address: string | null;
            settings: unknown;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            organizationId: string;
            city: string | null;
            postalCode: string | null;
            country: string | null;
            timezone: string | null;
            workingHours: unknown;
        };
    }[];
}[]>;
/**
 * Get staff members for a specific clinic
 * This includes both workers assigned via workerClinics AND users with clinicId directly in their profile
 */
export declare const getStaffByClinic: (clinicId: string) => Promise<{
    clinicRole: string | null;
    role: "SUPERADMIN" | "ADMIN" | "WORKER" | "USER";
    id: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string | null;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    clinicId: string | null;
    emailVerified: boolean;
    emailVerificationToken: string | null;
    passwordResetToken: string | null;
    passwordResetExpires: Date | null;
    twoFactorEnabled: boolean;
    tokenVersion: number;
    lastLoginAt: Date | null;
    staffProfile: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        licenseNumber: string | null;
        specialty: string | null;
        bio: string | null;
        color: string | null;
        workingDays: unknown;
    } | null;
}[]>;
/**
 * Assign a worker to a clinic
 */
export declare const assignWorkerToClinic: (userId: string, clinicId: string, role?: string) => Promise<{
    role: string | null;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    clinicId: string;
    userId: string;
} | undefined>;
/**
 * Remove a worker from a clinic
 */
export declare const removeWorkerFromClinic: (userId: string, clinicId: string) => Promise<boolean>;
/**
 * Get clinics for a worker
 */
export declare const getClinicsForWorker: (userId: string) => Promise<{
    role: string | null;
    name: string;
    id: string;
    slug: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    settings: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    timezone: string | null;
    workingHours: unknown;
    organization: {
        name: string;
        id: string;
        slug: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        logoUrl: string | null;
        settings: unknown;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
}[]>;
/**
 * Get accessible clinics for a user based on their role
 */
export declare const getAccessibleClinics: (userId: string, role: string, organizationId?: string | null) => Promise<{
    name: string;
    id: string;
    slug: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    settings: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    timezone: string | null;
    workingHours: unknown;
}[]>;
/**
 * Update staff profile
 */
export declare const updateStaffProfile: (userId: string, data: {
    licenseNumber?: string;
    specialty?: string;
    bio?: string;
    color?: string;
}) => Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    licenseNumber: string | null;
    specialty: string | null;
    bio: string | null;
    color: string | null;
    workingDays: unknown;
} | undefined>;
//# sourceMappingURL=staff.service.d.ts.map