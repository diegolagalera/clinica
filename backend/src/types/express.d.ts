import type { Database } from '../db/index.js';
import type { AccessTokenPayload, TenantContext } from './index.js';

// Augment Express Request to include multi-tenant properties
declare module 'express-serve-static-core' {
    interface Request {
        db?: Database;
        user?: AccessTokenPayload;
        tenantContext?: TenantContext;
    }
}
