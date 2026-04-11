-- Create intake form templates table
CREATE TABLE public.intake_form_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  form_type TEXT NOT NULL DEFAULT 'custom', -- medical_history, consent, insurance, custom
  fields JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  send_before_days INTEGER DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create patient form submissions table
CREATE TABLE public.patient_form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.intake_form_templates(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  form_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'pending', -- pending, completed, expired
  submitted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add patient tracking columns if not exist
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_returning_patient BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.intake_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for intake_form_templates
CREATE POLICY "Clinic owners can manage their templates"
ON public.intake_form_templates
FOR ALL
USING (owns_clinic(auth.uid(), clinic_id) OR is_admin(auth.uid()))
WITH CHECK (owns_clinic(auth.uid(), clinic_id) OR is_admin(auth.uid()));

CREATE POLICY "Public can view active global templates"
ON public.intake_form_templates
FOR SELECT
USING (clinic_id IS NULL AND is_active = true);

-- RLS policies for patient_form_submissions
CREATE POLICY "Clinic owners can view their submissions"
ON public.patient_form_submissions
FOR SELECT
USING (owns_clinic(auth.uid(), clinic_id) OR is_admin(auth.uid()));

CREATE POLICY "Anyone can insert submissions with valid token"
ON public.patient_form_submissions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update with access_token"
ON public.patient_form_submissions
FOR UPDATE
USING (true);

-- Create updated_at trigger for both tables
CREATE TRIGGER update_intake_form_templates_updated_at
BEFORE UPDATE ON public.intake_form_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_form_submissions_updated_at
BEFORE UPDATE ON public.patient_form_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default dental intake form templates (global)
INSERT INTO public.intake_form_templates (name, description, form_type, is_active, fields) VALUES
(
  'Medical History Form',
  'Comprehensive medical history questionnaire',
  'medical_history',
  true,
  '[
    {"id": "allergies", "label": "Do you have any allergies?", "type": "radio", "options": ["Yes", "No"], "required": true},
    {"id": "allergies_details", "label": "If yes, please list all allergies", "type": "textarea", "conditional": {"field": "allergies", "value": "Yes"}},
    {"id": "medications", "label": "Are you currently taking any medications?", "type": "radio", "options": ["Yes", "No"], "required": true},
    {"id": "medications_list", "label": "Please list all medications", "type": "textarea", "conditional": {"field": "medications", "value": "Yes"}},
    {"id": "medical_conditions", "label": "Do you have any of the following conditions?", "type": "checkbox", "options": ["Diabetes", "Heart Disease", "High Blood Pressure", "Asthma", "Epilepsy", "Bleeding Disorders", "Hepatitis", "HIV/AIDS", "Cancer", "Pregnancy", "None of the above"]},
    {"id": "surgery_history", "label": "Have you had any surgeries in the past 5 years?", "type": "radio", "options": ["Yes", "No"]},
    {"id": "surgery_details", "label": "Please describe the surgeries", "type": "textarea", "conditional": {"field": "surgery_history", "value": "Yes"}},
    {"id": "tobacco", "label": "Do you use tobacco products?", "type": "radio", "options": ["Yes", "No", "Former user"]},
    {"id": "alcohol", "label": "How often do you consume alcohol?", "type": "select", "options": ["Never", "Occasionally", "Weekly", "Daily"]},
    {"id": "last_dental_visit", "label": "When was your last dental visit?", "type": "select", "options": ["Within 6 months", "6-12 months ago", "1-2 years ago", "Over 2 years ago", "Never"]}
  ]'::jsonb
),
(
  'Dental History Form',
  'Previous dental treatments and concerns',
  'medical_history',
  true,
  '[
    {"id": "chief_complaint", "label": "What is your main dental concern today?", "type": "textarea", "required": true},
    {"id": "pain_level", "label": "Rate your current pain level (0-10)", "type": "select", "options": ["0 - No pain", "1-3 - Mild", "4-6 - Moderate", "7-9 - Severe", "10 - Worst possible"]},
    {"id": "dental_anxiety", "label": "Do you experience dental anxiety?", "type": "radio", "options": ["No", "Mild", "Moderate", "Severe"]},
    {"id": "previous_issues", "label": "Have you had any of the following?", "type": "checkbox", "options": ["Root Canal", "Tooth Extraction", "Dental Implant", "Braces/Orthodontics", "Gum Disease Treatment", "Teeth Whitening", "Crowns/Bridges", "Dentures"]},
    {"id": "brushing_frequency", "label": "How often do you brush?", "type": "select", "options": ["Once daily", "Twice daily", "More than twice", "Less than once daily"]},
    {"id": "flossing_frequency", "label": "How often do you floss?", "type": "select", "options": ["Daily", "Few times a week", "Rarely", "Never"]},
    {"id": "sensitive_teeth", "label": "Do you have sensitive teeth?", "type": "radio", "options": ["Yes", "No"]},
    {"id": "grinding_teeth", "label": "Do you grind or clench your teeth?", "type": "radio", "options": ["Yes", "No", "Not sure"]}
  ]'::jsonb
),
(
  'Treatment Consent Form',
  'General consent for dental treatment',
  'consent',
  true,
  '[
    {"id": "understand_treatment", "label": "I understand the proposed treatment, its alternatives, risks, and benefits have been explained to me", "type": "checkbox", "required": true},
    {"id": "consent_anesthesia", "label": "I consent to the use of local anesthesia as deemed necessary", "type": "checkbox", "required": true},
    {"id": "consent_xrays", "label": "I consent to X-rays and diagnostic imaging as needed", "type": "checkbox", "required": true},
    {"id": "accurate_info", "label": "I confirm all information provided is accurate to the best of my knowledge", "type": "checkbox", "required": true},
    {"id": "payment_agreement", "label": "I understand I am responsible for payment of services not covered by insurance", "type": "checkbox", "required": true},
    {"id": "patient_signature", "label": "Patient Signature (Type your full name)", "type": "text", "required": true},
    {"id": "consent_date", "label": "Date", "type": "date", "required": true}
  ]'::jsonb
),
(
  'Insurance Verification Form',
  'Collect insurance information',
  'insurance',
  true,
  '[
    {"id": "has_insurance", "label": "Do you have dental insurance?", "type": "radio", "options": ["Yes", "No"], "required": true},
    {"id": "insurance_provider", "label": "Insurance Provider", "type": "text", "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "policy_number", "label": "Policy/Member ID", "type": "text", "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "group_number", "label": "Group Number", "type": "text", "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "subscriber_name", "label": "Subscriber Name (if different from patient)", "type": "text", "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "subscriber_dob", "label": "Subscriber Date of Birth", "type": "date", "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "subscriber_relationship", "label": "Relationship to Subscriber", "type": "select", "options": ["Self", "Spouse", "Child", "Other"], "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "insurance_card_front", "label": "Upload Insurance Card (Front)", "type": "file", "conditional": {"field": "has_insurance", "value": "Yes"}},
    {"id": "insurance_card_back", "label": "Upload Insurance Card (Back)", "type": "file", "conditional": {"field": "has_insurance", "value": "Yes"}}
  ]'::jsonb
),
(
  'Patient Registration Form',
  'Basic patient information',
  'custom',
  true,
  '[
    {"id": "full_name", "label": "Full Legal Name", "type": "text", "required": true},
    {"id": "preferred_name", "label": "Preferred Name", "type": "text"},
    {"id": "date_of_birth", "label": "Date of Birth", "type": "date", "required": true},
    {"id": "gender", "label": "Gender", "type": "select", "options": ["Male", "Female", "Other", "Prefer not to say"]},
    {"id": "email", "label": "Email Address", "type": "email", "required": true},
    {"id": "phone", "label": "Phone Number", "type": "tel", "required": true},
    {"id": "address", "label": "Home Address", "type": "textarea"},
    {"id": "emergency_contact_name", "label": "Emergency Contact Name", "type": "text", "required": true},
    {"id": "emergency_contact_phone", "label": "Emergency Contact Phone", "type": "tel", "required": true},
    {"id": "emergency_contact_relation", "label": "Relationship to Emergency Contact", "type": "text"},
    {"id": "how_heard", "label": "How did you hear about us?", "type": "select", "options": ["Google Search", "Social Media", "Friend/Family", "Insurance Provider", "Walk-in", "Other"]},
    {"id": "communication_preference", "label": "Preferred Communication Method", "type": "checkbox", "options": ["SMS", "Email", "WhatsApp", "Phone Call"]}
  ]'::jsonb
);

-- Create index for faster lookups
CREATE INDEX idx_intake_templates_clinic ON public.intake_form_templates(clinic_id);
CREATE INDEX idx_form_submissions_clinic ON public.patient_form_submissions(clinic_id);
CREATE INDEX idx_form_submissions_token ON public.patient_form_submissions(access_token);
CREATE INDEX idx_form_submissions_status ON public.patient_form_submissions(status);