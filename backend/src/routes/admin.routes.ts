import { Router } from 'express';
import type { Response } from 'express';
import { authenticate, requireSuperAdmin } from '../middleware/index.js';
import { asyncHandler } from '../middleware/index.js';
import { centralDb } from '../db/central-db.js';
import { tenants } from '../db/central-schema.js';
import { eq } from 'drizzle-orm';
import { success } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require SUPERADMIN
router.use(authenticate);
router.use(requireSuperAdmin);

/**
 * GET /admin/tenants
 * List all tenants from central DB (no req.db needed)
 */
router.get('/tenants', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const allTenants = await centralDb.query.tenants.findMany({
        orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    res.json(success(allTenants));
}));

/**
 * GET /admin/tenants/:slug
 * Get single tenant info from central DB
 */
router.get('/tenants/:slug', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { slug } = req.params;

    const tenant = await centralDb.query.tenants.findFirst({
        where: eq(tenants.slug, slug as string),
    });

    if (!tenant) {
        res.status(404).json({ success: false, message: 'Tenant not found' });
        return;
    }

    res.json(success(tenant));
}));

export default router;
