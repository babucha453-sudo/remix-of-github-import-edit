-- Add Connecticut state
INSERT INTO public.states (name, slug, abbreviation, is_active, display_order)
VALUES ('Connecticut', 'connecticut', 'CT', true, 3)
ON CONFLICT (slug) DO UPDATE SET is_active = true, display_order = 3;

-- Deactivate all old UAE/Dubai cities and areas
UPDATE public.cities SET is_active = false WHERE state_id IS NULL;
UPDATE public.areas SET is_active = false;