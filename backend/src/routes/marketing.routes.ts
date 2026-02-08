import { Router } from 'express';
import { marketingTemplateService } from '../services/marketing-template.service.js';
import { audienceService } from '../services/audience.service.js';
import { campaignService } from '../services/campaign.service.js';
import { birthdayService } from '../services/birthday.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Middleware to get clinicId from auth
const getClinicId = (req: any): string => {
    const clinicId = req.headers['x-clinic-id'] || req.user?.clinicId;
    if (!clinicId) {
        throw new Error('Clinic ID is required');
    }
    return clinicId as string;
};

const getUserId = (req: any): string => {
    return req.user?.id || 'system';
};

// ============================================================================
// TEMPLATES
// ============================================================================

// Get all templates (system + clinic)
router.get('/templates', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const templates = await marketingTemplateService.getTemplates(clinicId);
        res.json(templates);
    } catch (error) {
        next(error);
    }
});

// Get system templates only
router.get('/templates/system', async (req, res, next) => {
    try {
        const templates = await marketingTemplateService.getSystemTemplates();
        res.json(templates);
    } catch (error) {
        next(error);
    }
});

// Get template by ID
router.get('/templates/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const template = await marketingTemplateService.getTemplateById(req.params.id, clinicId);
        if (!template) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }
        res.json(template);
    } catch (error) {
        next(error);
    }
});

// Create template
router.post('/templates', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const userId = getUserId(req);
        const template = await marketingTemplateService.createTemplate(clinicId, userId, req.body);
        res.status(201).json(template);
    } catch (error) {
        next(error);
    }
});

// Update template
router.put('/templates/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const template = await marketingTemplateService.updateTemplate(
            req.params.id,
            clinicId,
            req.body
        );
        res.json(template);
    } catch (error) {
        next(error);
    }
});

// Delete template
router.delete('/templates/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        await marketingTemplateService.deleteTemplate(req.params.id, clinicId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Clone system template
router.post('/templates/:id/clone', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const userId = getUserId(req);
        const { name } = req.body;
        const template = await marketingTemplateService.cloneSystemTemplate(
            req.params.id,
            clinicId,
            userId,
            name
        );
        res.status(201).json(template);
    } catch (error) {
        next(error);
    }
});

// Get template variables
router.get('/templates-variables', async (_req, res) => {
    res.json(marketingTemplateService.getTemplateVariables());
});

// ============================================================================
// SEGMENTS
// ============================================================================

// Get all segments
router.get('/segments', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const segments = await audienceService.getSegments(clinicId);
        res.json(segments);
    } catch (error) {
        next(error);
    }
});

// Get segment by ID
router.get('/segments/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const segment = await audienceService.getSegmentById(req.params.id, clinicId);
        if (!segment) {
            res.status(404).json({ error: 'Segment not found' });
            return;
        }
        res.json(segment);
    } catch (error) {
        next(error);
    }
});

// Create segment
router.post('/segments', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const userId = getUserId(req);
        const segment = await audienceService.createSegment(clinicId, userId, req.body);
        res.status(201).json(segment);
    } catch (error) {
        next(error);
    }
});

// Update segment
router.put('/segments/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const segment = await audienceService.updateSegment(req.params.id, clinicId, req.body);
        res.json(segment);
    } catch (error) {
        next(error);
    }
});

// Delete segment
router.delete('/segments/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        await audienceService.deleteSegment(req.params.id, clinicId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Preview segment filters
router.post('/segments/preview', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const { filters, limit } = req.body;
        const preview = await audienceService.previewFilters(clinicId, filters, limit || 10);
        res.json(preview);
    } catch (error) {
        next(error);
    }
});

// Get available filters
router.get('/segments-filters', async (_req, res) => {
    res.json(audienceService.getAvailableFilters());
});

// Refresh segment count
router.post('/segments/:id/refresh', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const count = await audienceService.refreshSegmentCount(req.params.id, clinicId);
        res.json({ count });
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// CAMPAIGNS
// ============================================================================

// Get all campaigns
router.get('/campaigns', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const campaigns = await campaignService.getCampaigns(clinicId);
        res.json(campaigns);
    } catch (error) {
        next(error);
    }
});

// Get campaign by ID
router.get('/campaigns/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const campaign = await campaignService.getCampaignById(req.params.id, clinicId);
        if (!campaign) {
            res.status(404).json({ error: 'Campaign not found' });
            return;
        }
        res.json(campaign);
    } catch (error) {
        next(error);
    }
});

// Create campaign
router.post('/campaigns', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const userId = getUserId(req);
        const campaign = await campaignService.createCampaign(clinicId, userId, req.body);
        res.status(201).json(campaign);
    } catch (error) {
        next(error);
    }
});

// Update campaign
router.put('/campaigns/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const campaign = await campaignService.updateCampaign(req.params.id, clinicId, req.body);
        res.json(campaign);
    } catch (error) {
        next(error);
    }
});

// Delete campaign
router.delete('/campaigns/:id', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        await campaignService.deleteCampaign(req.params.id, clinicId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Send campaign
router.post('/campaigns/:id/send', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const result = await campaignService.sendCampaign(req.params.id, clinicId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Cancel campaign
router.post('/campaigns/:id/cancel', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        await campaignService.cancelCampaign(req.params.id, clinicId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Get campaign recipients
router.get('/campaigns/:id/recipients', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const recipients = await campaignService.getCampaignRecipients(req.params.id, clinicId);
        res.json(recipients);
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// BIRTHDAY SETTINGS
// ============================================================================

// Get birthday settings
router.get('/birthday/settings', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const settings = await birthdayService.getSettings(clinicId);
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

// Update birthday settings
router.put('/birthday/settings', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const settings = await birthdayService.updateSettings(clinicId, req.body);
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

// Send test birthday email
router.post('/birthday/test', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }
        const result = await birthdayService.sendTestEmail(clinicId, email);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get today's birthday patients (admin preview)
router.get('/birthday/today', async (req, res, next) => {
    try {
        const clinicId = getClinicId(req);
        const patients = await birthdayService.getPatientsWithBirthdayOn(clinicId);
        res.json(patients);
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// ADMIN: Seed system templates
// ============================================================================

router.post('/admin/seed-templates', async (_req, res, next) => {
    try {
        await marketingTemplateService.seedSystemTemplates();
        res.json({ success: true, message: 'System templates seeded' });
    } catch (error) {
        next(error);
    }
});

export default router;
