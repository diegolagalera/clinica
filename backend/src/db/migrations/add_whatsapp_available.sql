-- Add WhatsApp availability tracking to patients
-- null = unknown, true = confirmed on WA, false = not a WA number
ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_available BOOLEAN DEFAULT NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS whatsapp_checked_at TIMESTAMP DEFAULT NULL;
