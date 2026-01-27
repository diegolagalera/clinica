import { Router } from 'express';
import * as organizationController from '../controllers/organization.controller.js';
import { authenticate, requireSuperAdmin } from '../middleware/index.js';

const router = Router();

// All routes require SUPERADMIN role
router.use(authenticate);
router.use(requireSuperAdmin);

// List organizations
router.get('/', organizationController.listOrganizations);

// Get organization by ID
router.get('/:id', organizationController.getOrganization);

// Get organization stats
router.get('/:id/stats', organizationController.getOrganizationStats);

// Create organization
router.post('/', organizationController.createOrganization);

// Update organization
router.put('/:id', organizationController.updateOrganization);

// Delete organization
router.delete('/:id', organizationController.deleteOrganization);

export default router;
