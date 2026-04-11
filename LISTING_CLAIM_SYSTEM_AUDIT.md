# Listing & Claim System Audit & Implementation Plan

## PART 1: EXISTING SYSTEM AUDIT

### ✅ EXISTING COMPONENTS

**1. List Your Practice (`ListYourPracticePage.tsx`)**
- Location: `src/pages/ListYourPracticePage.tsx`
- Flow: 3-step manual form
- Steps:
  - Step 1: Basic Info (clinic name, dentist name, location, address)
  - Step 2: Contact Info (email, phone, website)
  - Step 3: Services & Submit
- Submission: Creates lead in `leads` table (NOT clinic record)
- No user account creation
- No real clinic record created
- Status: LEAD ONLY - not a full listing system

**2. Claim Profile (`ClaimProfilePage.tsx`)**
- Simple search for existing profiles
- Updates `claim_status` to 'claimed' on existing clinic
- No verification workflow
- No admin approval needed

**3. Current Tables**
- `clinics` - Main listing table (but leads feed into it differently)
- `leads` - Captured from listing form

---

### ❌ MISSING FUNCTIONALITY

| Feature | Status | Priority |
|---------|--------|----------|
| Real clinic creation from onboarding | MISSING | CRITICAL |
| User account creation during listing | MISSING | CRITICAL |
| Draft save system | MISSING | HIGH |
| Step-based wizard with progress save | PARTIAL | HIGH |
| Claim verification workflow | MISSING | CRITICAL |
| Admin approval queue | MISSING | CRITICAL |
| Profile completion score | MISSING | HIGH |
| Document upload for verification | MISSING | HIGH |
| Owner/team management | MISSING | HIGH |
| Duplicate detection | MISSING | MEDIUM |
| Activity/audit logging | MISSING | MEDIUM |
| Verification status workflow | MISSING | HIGH |

---

## PART 2: PROPOSED DATA MODEL

### NEW TABLES REQUIRED

```sql
-- ============================================================================
-- LISTING ONBOARDING SYSTEM TABLES
-- ============================================================================

-- 1. LISTING DRAFTS - Saves progress during onboarding
CREATE TABLE listing_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Step data as JSON
  step_1_data JSONB DEFAULT '{}',
  step_2_data JSONB DEFAULT '{}',
  step_3_data JSONB DEFAULT '{}',
  step_4_data JSONB DEFAULT '{}',
  step_5_data JSONB DEFAULT '{}',
  step_6_data JSONB DEFAULT '{}',
  
  current_step INTEGER DEFAULT 1,
  completion_score INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'converted', 'abandoned')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  is_active BOOLEAN DEFAULT true
);

-- 2. LISTING CLAIMS - For claiming existing listings
CREATE TABLE listing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Claim details
  claim_method TEXT NOT NULL CHECK (claim_method IN ('business_email', 'phone_otp', 'website', 'document', 'manual')),
  claim_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Verification data
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT,
  claimant_role TEXT,
  proof_documents JSONB DEFAULT '[]',
  verification_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'pending_verification', 'pending_admin_review', 
    'approved', 'rejected', 'need_more_info'
  )),
  rejection_reason TEXT,
  
  -- Admin review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLINIC TEAM MEMBERSHIP - Owners and staff
CREATE TABLE clinic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'dentist')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LISTING DOCUMENTS - Verification documents, licenses, etc.
CREATE TABLE listing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  listing_claim_id UUID REFERENCES listing_claims(id) ON DELETE SET NULL,
  
  document_type TEXT NOT NULL CHECK (document_type IN (
    'business_license', 'dental_license', 'insurance', 
    'photo_id', 'proof_of_ownership', 'other'
  )),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ONBOARDING PROGRESS - Track user progress through listing
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  current_step INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',
  skipped_steps JSONB DEFAULT '[]',
  
  -- Section completion
  basic_info_complete BOOLEAN DEFAULT false,
  location_complete BOOLEAN DEFAULT false,
  services_complete BOOLEAN DEFAULT false,
  profile_complete BOOLEAN DEFAULT false,
  media_complete BOOLEAN DEFAULT false,
  verification_complete BOOLEAN DEFAULT false,
  
  last_step_visited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ACTIVITY LOGS - Audit trail for listings
CREATE TABLE listing_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL,
  action_details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. APPROVAL LOGS - Admin actions on listings
CREATE TABLE listing_approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'suspended', 'reinstated', 'verified', 'unverified')),
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## PART 3: LISTING STATUS LIFECYCLE

```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → LIVE
                              → REJECTED → RESUBMIT
                              → SUSPENDED → REINSTATED
```

**Status Definitions:**
- `draft` - User filling out onboarding
- `submitted` - User submitted for review
- `under_review` - Admin reviewing
- `approved` - Approved, awaiting final review
- `rejected` - Rejected, needs changes
- `suspended` - Temporarily suspended
- `active` / `live` - Fully published

**Claim Status:**
- `initiated` - Claim started
- `pending_verification` - Awaiting email/phone verification
- `pending_admin_review` - Awaiting admin approval
- `approved` - Claim approved, ownership transferred
- `rejected` - Claim rejected
- `need_more_info` - More information needed

---

## PART 4: PROFILE COMPLETENESS SCORE

**Required Fields for 100% Completion:**

| Section | Fields | Weight |
|---------|--------|--------|
| Basic Info | name, slug | 15% |
| Location | address, city_id, coordinates | 15% |
| Contact | phone, email | 10% |
| About | description | 15% |
| Services | at least 1 service | 15% |
| Hours | opening_hours | 10% |
| Media | at least 1 image | 10% |
| Verification | verification_status = verified | 10% |

**Minimum for Live:** 70% completion + verified

---

## PART 5: BUILD SEQUENCE

### Phase 1: Database Setup
1. Create tables: listing_drafts, listing_claims, clinic_members, listing_documents, onboarding_progress, listing_activity_logs, listing_approval_logs

### Phase 2: Core Onboarding
2. Create new multi-step ListYourClinic wizard with real clinic creation
3. Add user account creation during onboarding
4. Add draft save/load functionality
5. Add profile completion score

### Phase 3: Claim Flow
6. Build Claim Profile wizard with verification options
7. Add admin approval queue for claims
8. Add claim document upload

### Phase 4: Admin Controls
9. Create New Listings Queue in admin dashboard
10. Create Claims Queue in admin dashboard
11. Add verification review panel
12. Add activity logging

### Phase 5: Enhancements
13. Add duplicate detection
14. Add profile preview mode
15. Add email notifications

---

## PART 6: COMPONENT CHANGES

### New Components to Create:
1. `src/pages/ListYourClinicPage.tsx` - New comprehensive onboarding
2. `src/pages/ClaimClinicPage.tsx` - New claim flow with verification
3. `src/components/onboarding/OnboardingWizard.tsx` - Step wizard
4. `src/components/onboarding/DraftSaver.tsx` - Auto-save
5. `src/components/admin/ListingQueue.tsx` - Admin queue
6. `src/components/admin/ClaimQueue.tsx` - Claims queue

### Updated Components:
1. `src/pages/ListYourPracticePage.tsx` - Either replace or update to create real clinic
2. Admin dashboard - Add Listing & Claims management panels

---

## PART 7: DB READY COMMANDS

```sql
-- ============================================================================
-- RUN THESE IN SUPABASE SQL EDITOR
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: listing_drafts
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  step_1_data JSONB DEFAULT '{}',
  step_2_data JSONB DEFAULT '{}',
  step_3_data JSONB DEFAULT '{}',
  step_4_data JSONB DEFAULT '{}',
  step_5_data JSONB DEFAULT '{}',
  step_6_data JSONB DEFAULT '{}',
  current_step INTEGER DEFAULT 1,
  completion_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'converted', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- ============================================================================
-- TABLE: listing_claims
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claim_method TEXT NOT NULL CHECK (claim_method IN ('business_email', 'phone_otp', 'website', 'document', 'manual')),
  claim_token TEXT,
  token_expires_at TIMESTAMPTZ,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  claimant_phone TEXT,
  claimant_role TEXT,
  proof_documents JSONB DEFAULT '[]',
  verification_notes TEXT,
  status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending_verification', 'pending_admin_review', 'approved', 'rejected', 'need_more_info')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: clinic_members
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'dentist')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, user_id)
);

-- ============================================================================
-- TABLE: listing_documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  listing_claim_id UUID REFERENCES listing_claims(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('business_license', 'dental_license', 'insurance', 'photo_id', 'proof_of_ownership', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: onboarding_progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',
  skipped_steps JSONB DEFAULT '[]',
  basic_info_complete BOOLEAN DEFAULT false,
  location_complete BOOLEAN DEFAULT false,
  services_complete BOOLEAN DEFAULT false,
  profile_complete BOOLEAN DEFAULT false,
  media_complete BOOLEAN DEFAULT false,
  verification_complete BOOLEAN DEFAULT false,
  last_step_visited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: listing_activity_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  action_details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: listing_approval_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS listing_approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'suspended', 'reinstated', 'verified', 'unverified')),
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RLS POLICIES (Add for each table)
-- ============================================================================
ALTER TABLE listing_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_approval_logs ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own drafts
CREATE POLICY "Users can manage own drafts" ON listing_drafts
  FOR ALL USING (user_id = auth.uid());

-- Users can manage own onboarding progress
CREATE POLICY "Users can manage own progress" ON onboarding_progress
  FOR ALL USING (user_id = auth.uid());

-- Public can create claims
CREATE POLICY "Anyone can create claims" ON listing_claims
  FOR INSERT WITH CHECK (true);

-- Clinic owners can manage members
CREATE POLICY "Owners can manage members" ON clinic_members
  FOR ALL USING (
    user_id = auth.uid() OR 
    EXISTS(SELECT 1 FROM clinic_members WHERE clinic_id = clinic_id AND user_id = auth.uid() AND role = 'owner')
  );
```