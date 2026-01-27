-- Migration: add_notification_system
-- Created at: 2026-01-26

-- Enums
DO $$ BEGIN
    CREATE TYPE email_template_type AS ENUM (
        'APPOINTMENT_CREATED',
        'APPOINTMENT_REMINDER_24H',
        'APPOINTMENT_REMINDER_1H',
        'APPOINTMENT_CANCELLED',
        'DOCUMENT_SIGNED',
        'CUSTOM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_status AS ENUM (
        'PENDING',
        'SENT',
        'FAILED',
        'BOUNCED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Email Settings Table
CREATE TABLE IF NOT EXISTS email_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
    smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_pass VARCHAR(500),
    from_name VARCHAR(100),
    from_email VARCHAR(255),
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    is_configured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    type email_template_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    blocks JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_templates_clinic_type_idx ON email_templates(clinic_id, type);

-- Notification Logs Table
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    template_type email_template_type NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'email',
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    status notification_status NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_logs_clinic_idx ON notification_logs(clinic_id);
CREATE INDEX IF NOT EXISTS notification_logs_patient_idx ON notification_logs(patient_id);
CREATE INDEX IF NOT EXISTS notification_logs_status_idx ON notification_logs(status);
CREATE INDEX IF NOT EXISTS notification_logs_created_at_idx ON notification_logs(created_at);
