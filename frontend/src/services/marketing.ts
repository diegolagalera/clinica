import { api } from './api';

// Types
export interface MarketingTemplate {
    id: string;
    clinicId: string | null;
    name: string;
    subject: string;
    category: string;
    designJson: any;
    htmlContent: string | null;
    previewText: string | null;
    thumbnailUrl: string | null;
    isSystemTemplate: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AudienceSegment {
    id: string;
    clinicId: string;
    name: string;
    description: string | null;
    filters: SegmentFilter[];
    patientCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SegmentFilter {
    field: string;
    operator: string;
    value: any;
    value2?: any;
}

export interface MarketingCampaign {
    id: string;
    clinicId: string;
    templateId: string | null;
    segmentId: string | null;
    name: string;
    subject: string;
    htmlContent: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'PAUSED' | 'CANCELLED';
    scheduledAt: string | null;
    sentAt: string | null;
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface BirthdaySettings {
    id: string | null;
    clinicId: string;
    isEnabled: boolean;
    templateId: string | null;
    sendHour: number;
    daysInAdvance: number;
    createdAt: string | null;
    updatedAt: string | null;
}

export interface FilterOption {
    field: string;
    label: string;
    operators: string[];
    valueType: string;
    options?: { value: any; label: string }[];
}

export interface SegmentPreview {
    count: number;
    patients: { id: string; firstName: string; lastName: string; email: string | null }[];
}

// ============================================================================
// TEMPLATES API
// ============================================================================

export const getMarketingTemplates = async (): Promise<MarketingTemplate[]> => {
    return api.get<MarketingTemplate[]>('/marketing/templates');
};

export const getSystemTemplates = async (): Promise<MarketingTemplate[]> => {
    return api.get<MarketingTemplate[]>('/marketing/templates/system');
};

export const getMarketingTemplate = async (id: string): Promise<MarketingTemplate> => {
    return api.get<MarketingTemplate>(`/marketing/templates/${id}`);
};

export const createMarketingTemplate = async (data: {
    name: string;
    subject: string;
    category?: string;
    designJson: any;
    htmlContent?: string;
    previewText?: string;
}): Promise<MarketingTemplate> => {
    return api.post<MarketingTemplate>('/marketing/templates', data);
};

export const updateMarketingTemplate = async (
    id: string,
    data: Partial<MarketingTemplate>
): Promise<MarketingTemplate> => {
    return api.put<MarketingTemplate>(`/marketing/templates/${id}`, data);
};

export const deleteMarketingTemplate = async (id: string): Promise<void> => {
    await api.delete(`/marketing/templates/${id}`);
};

export const cloneSystemTemplate = async (id: string, name?: string): Promise<MarketingTemplate> => {
    return api.post<MarketingTemplate>(`/marketing/templates/${id}/clone`, { name });
};

export const getTemplateVariables = async (): Promise<Record<string, string>> => {
    return api.get<Record<string, string>>('/marketing/templates-variables');
};

// ============================================================================
// SEGMENTS API
// ============================================================================

export const getAudienceSegments = async (): Promise<AudienceSegment[]> => {
    return api.get<AudienceSegment[]>('/marketing/segments');
};

export const getAudienceSegment = async (id: string): Promise<AudienceSegment> => {
    return api.get<AudienceSegment>(`/marketing/segments/${id}`);
};

export const createAudienceSegment = async (data: {
    name: string;
    description?: string;
    filters: SegmentFilter[];
}): Promise<AudienceSegment> => {
    return api.post<AudienceSegment>('/marketing/segments', data);
};

export const updateAudienceSegment = async (
    id: string,
    data: Partial<AudienceSegment>
): Promise<AudienceSegment> => {
    return api.put<AudienceSegment>(`/marketing/segments/${id}`, data);
};

export const deleteAudienceSegment = async (id: string): Promise<void> => {
    await api.delete(`/marketing/segments/${id}`);
};

export const previewSegmentFilters = async (
    filters: SegmentFilter[],
    limit?: number
): Promise<SegmentPreview> => {
    return api.post<SegmentPreview>('/marketing/segments/preview', { filters, limit });
};

export const getAvailableFilters = async (): Promise<FilterOption[]> => {
    return api.get<FilterOption[]>('/marketing/segments-filters');
};

export const refreshSegmentCount = async (id: string): Promise<{ count: number }> => {
    return api.post<{ count: number }>(`/marketing/segments/${id}/refresh`);
};

// ============================================================================
// CAMPAIGNS API
// ============================================================================

export const getMarketingCampaigns = async (): Promise<MarketingCampaign[]> => {
    return api.get<MarketingCampaign[]>('/marketing/campaigns');
};

export const getMarketingCampaign = async (id: string): Promise<MarketingCampaign> => {
    return api.get<MarketingCampaign>(`/marketing/campaigns/${id}`);
};

export const createMarketingCampaign = async (data: {
    name: string;
    subject: string;
    templateId?: string;
    segmentId?: string;
    htmlContent?: string;
    scheduledAt?: string;
}): Promise<MarketingCampaign> => {
    return api.post<MarketingCampaign>('/marketing/campaigns', data);
};

export const updateMarketingCampaign = async (
    id: string,
    data: Partial<MarketingCampaign>
): Promise<MarketingCampaign> => {
    return api.put<MarketingCampaign>(`/marketing/campaigns/${id}`, data);
};

export const deleteMarketingCampaign = async (id: string): Promise<void> => {
    await api.delete(`/marketing/campaigns/${id}`);
};

export const sendMarketingCampaign = async (id: string): Promise<{
    totalRecipients: number;
    sentCount: number;
    failedCount: number;
}> => {
    return api.post<{
        totalRecipients: number;
        sentCount: number;
        failedCount: number;
    }>(`/marketing/campaigns/${id}/send`);
};

export const cancelMarketingCampaign = async (id: string): Promise<void> => {
    await api.post(`/marketing/campaigns/${id}/cancel`);
};

interface CampaignRecipient {
    id: string;
    patientId: string;
    email: string;
    status: string;
    sentAt: string | null;
    errorMessage: string | null;
}

export const getCampaignRecipients = async (id: string): Promise<CampaignRecipient[]> => {
    return api.get<CampaignRecipient[]>(`/marketing/campaigns/${id}/recipients`);
};

// ============================================================================
// BIRTHDAY SETTINGS API
// ============================================================================

export const getBirthdaySettings = async (): Promise<BirthdaySettings> => {
    return api.get<BirthdaySettings>('/marketing/birthday/settings');
};

export const updateBirthdaySettings = async (data: {
    isEnabled: boolean;
    templateId?: string | null;
    sendHour?: number;
    daysInAdvance?: number;
}): Promise<BirthdaySettings> => {
    return api.put<BirthdaySettings>('/marketing/birthday/settings', data);
};

export const sendTestBirthdayEmail = async (email: string): Promise<{ sent: boolean; email: string }> => {
    return api.post<{ sent: boolean; email: string }>('/marketing/birthday/test', { email });
};

interface BirthdayPatient {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    birthday: string;
}

export const getTodaysBirthdayPatients = async (): Promise<BirthdayPatient[]> => {
    return api.get<BirthdayPatient[]>('/marketing/birthday/today');
};

// ============================================================================
// ADMIN API
// ============================================================================

export const seedSystemTemplates = async (): Promise<void> => {
    await api.post('/marketing/admin/seed-templates');
};
