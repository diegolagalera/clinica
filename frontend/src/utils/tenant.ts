/**
 * Subdomain-based tenant resolution utility
 *
 * Extracts the tenant slug from the current hostname:
 *   - mi-clinica.localhost       → "mi-clinica"
 *   - mi-clinica.cuspia.com      → "mi-clinica"
 *   - admin.localhost             → null (SuperAdmin)
 *   - admin.cuspia.com            → null (SuperAdmin)
 *   - localhost (no subdomain)    → null
 */

/** Reserved subdomains that are NOT tenant slugs */
const RESERVED_SUBDOMAINS = ['admin', 'www', 'api', 'app']

/**
 * Get the tenant slug from the current hostname.
 * Returns null if on SuperAdmin domain, no subdomain, or reserved subdomain.
 */
export function getTenantSlug(): string | null {
    const hostname = window.location.hostname

    // Plain localhost — no subdomain
    if (hostname === 'localhost' || hostname === '127.0.0.1') return null

    const parts = hostname.split('.')

    // Need at least 2 parts: "mi-clinica.localhost" or "mi-clinica.cuspia.com"
    if (parts.length < 2) return null

    const subdomain = parts[0]

    // Reserved subdomains are not tenants
    if (RESERVED_SUBDOMAINS.includes(subdomain)) return null

    return subdomain
}

/**
 * Check if we're on the SuperAdmin domain (admin.localhost or admin.cuspia.com)
 */
export function isSuperAdminDomain(): boolean {
    const hostname = window.location.hostname
    return hostname.startsWith('admin.')
}

/**
 * Check if we're on a tenant subdomain (not admin, not bare localhost)
 */
export function isTenantDomain(): boolean {
    return getTenantSlug() !== null
}

/**
 * Get the base domain for building URLs
 * In dev: "localhost:5173"
 * In prod: "cuspia.com"
 */
export function getBaseDomain(): string {
    const hostname = window.location.hostname
    const port = window.location.port

    if (hostname.endsWith('.localhost') || hostname === 'localhost') {
        return port ? `localhost:${port}` : 'localhost'
    }

    // Production: extract cuspia.com from mi-clinica.cuspia.com
    const parts = hostname.split('.')
    const baseDomain = parts.slice(-2).join('.')
    return port ? `${baseDomain}:${port}` : baseDomain
}
