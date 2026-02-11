-- Add new dental conditions for professional dental practice
ALTER TYPE dental_condition ADD VALUE IF NOT EXISTS 'TEMPORARY_FILLING';
ALTER TYPE dental_condition ADD VALUE IF NOT EXISTS 'EROSION';
ALTER TYPE dental_condition ADD VALUE IF NOT EXISTS 'ABRASION';
ALTER TYPE dental_condition ADD VALUE IF NOT EXISTS 'PERIAPICAL_LESION';
ALTER TYPE dental_condition ADD VALUE IF NOT EXISTS 'ROOT_RESORPTION';
ALTER TYPE dental_condition ADD VALUE IF NOT EXISTS 'ROOT_FRACTURE';

-- Add root condition column to odontogram_teeth
ALTER TABLE odontogram_teeth ADD COLUMN IF NOT EXISTS root_condition dental_condition DEFAULT 'HEALTHY';
