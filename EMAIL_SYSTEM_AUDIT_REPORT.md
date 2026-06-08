# AppointPanda Email System Audit Report

**Date:** June 8, 2026
**Scope:** Full email notification system across all roles (patients, dentists, SuperAdmins)
**Provider:** Resend (primary), SMTP (fallback for OTP + outreach)

---

## PHASE 1: Email System Configuration

### Provider: Resend
- **Status:** ✅ Configured
- **API Key:** Read from `RESEND_API_KEY` env var (Supabase secret)
- **20 edge functions** read the key via `Deno.env.get("RESEND_API_KEY")`
- **Endpoint:** `https://api.resend.com/emails`
- **SDK:** Resend npm SDK used in 2 functions, raw fetch in 18

### SMTP Fallback
- **Status:** ✅ Configured (stored in `global_settings` key `"smtp"`)
- **Used by:** `send-claim-otp` (tried first, falls back to Resend), `send-outreach` (only SMTP)
- **Stored config:** host, port, username, password, from_email, from_name, enabled
- **Issue:** Two different interface shapes (`user`/`pass` vs `username`/`password`)

### Domain Authentication
- **Status:** ❌ No SPF/DKIM/DMARC config in codebase
- **Error handling:** Shared `sendEmail()` catches 403 "verify a domain" errors
- **Risk:** Resend requires domain verification; if `appointpanda.com` is unverified, ALL sends fail

### Sender Address
- **Default:** `Appoint Panda <no-reply@appointpanda.com>`
- **Configurable:** Via `global_settings` key `"email"` (from_email, from_name)
- **Issue ❌:** `noreply` (no hyphen) vs `no-reply` (with hyphen) used inconsistently across functions

### Reply-To
- **Status:** ❌ Supported in `sendEmail()` but NEVER used by any caller
- **Impact:** Patients can't reply to email notifications

### Env Files
- **Status:** ❌ `RESEND_API_KEY` not in `.env` or `.env.example`
- Managed exclusively as Supabase Edge Function secret

### Email Queue/Retry
- **Status:** ❌ No retry mechanism for failed deliveries
- **Status:** ❌ No email queue system
- Each function makes a single attempt and returns success/failure

### Email Logging Schema
- **Status:** ❌ **CRITICAL** - Schema mismatch between code and SQL
- `logEmail()` inserts `email_type`, `error`, `resend_id`, `user_id` but SQL schema has `type`, `error_message`, no `resend_id`, and `dentist_id` instead of `user_id`
- **Risk:** All `logEmail()` calls may be silently failing or throwing errors

---

## PHASE 2: Email Templates

### Summary
- **27 total template implementations** across 13 shared + 14 inline/hybrid
- **6 shared templates are dead code** (never imported by any function)
- **7 concepts have duplicate implementations** (shared + inline versions diverge)

### Dead Code (Shared Templates Not Used)
| Template | Line | Used By? |
|----------|------|----------|
| `generateBookingEmailHTML` | email.ts:166 | ❌ Not called - `send-booking-email` has inline version |
| `generatePasswordResetHTML` | email.ts:352 | ❌ Not called - `admin-send-password-reset` uses branding.ts wrapper |
| `generateClaimSuccessHTML` | email.ts:370 | ❌ Not called - `verify-claim-otp` has inline version |
| `generateTeamInviteHTML` | email.ts:398 | ❌ Not called - `invite-team-member` has inline version |
| `generateListingConfirmationHTML` | email.ts:416 | ❌ Not called - `send-listing-confirmation` uses branding.ts wrapper |
| `generateReviewRequestHTML` | email.ts:296 | ❌ Not called - both review senders have inline versions |

### Functions Bypassing Shared `sendEmail()`
| Function | Sends Via | Has logEmail? | Has Support Link? |
|----------|-----------|---------------|-------------------|
| `send-review-request` | Raw Resend | ❌ | ❌ |
| `review-request-automation` | Raw Resend | ❌ | ❌ |
| `invite-team-member` | Raw Resend | ❌ | ❌ |
| `admin-create-user` | Raw Resend | ❌ | ❌ |
| `verify-claim-otp` | Raw Resend | ❌ | ❌ |
| `send-claim-otp` | SMTP then Resend | ❌ | ❌ |
| `approve-listing` | Raw Resend | ❌ | ✅ (branding.ts) |
| `admin-send-password-reset` | Resend SDK | ❌ | ✅ (branding.ts) |
| `send-outreach` | SMTP | ❌ | ❌ |
| `test-resend-email` | Raw Resend | ❌ | ❌ |
| `send-listing-confirmation` | Shared sendEmail | ❌ | ✅ (branding.ts) |
| `send-booking-email` | Shared sendEmail | ❌ | ❌ (clinic info only) |
| `dentist-signup` | Shared sendEmail | ❌ | ✅ (via template) |

### Missing Support/Contact Links
Inline templates missing support links: `send-booking-email`, `send-form-request`, `notify-dentist-submission`, `send-review-request`, `review-request-automation`, `admin-create-user`, `send-claim-otp`, `verify-claim-otp`

---

## PHASE 3: Patient/User Emails

### Signup Flow
- **Dentist signup:** ✅ Welcome email sent via `generateApprovalCredentialsHTML`
- **Patient signup:** ❌ No custom welcome email (uses Supabase Auth built-in)
- **Admin-create-user:** ✅ Welcome email with credentials
- **Security ❌:** Plaintext password sent in email (dentist-signup, admin-create-user, approve-listing)

### Password Reset
- **Admin-initiated:** ✅ Works via `admin-send-password-reset`
- **User-initiated:** ❌ No "forgot password" UI found in frontend code

### Appointment Flow
- **New booking:** ✅ Patient receives email for all statuses
- **Status change:** ✅ Sent for pending/confirmed/completed/cancelled/no_show
- **Reminder (email):** ❌ Function exists (`send-email-reminder`) but NOT triggered by any cron
- **Reminder (SMS):** ✅ Works via `appointment-reminder-trigger`
- **Subscription check:** ✅ Paid clinics get dentist notified; free tier clinics don't

### Review/Survey
- **Manual review request:** ✅ Works via `send-review-request`
- **Automated sequence:** ✅ 3-step (Day 0, 3, 7) via `review-request-automation`
- **Issue:** Both bypass shared `sendEmail()` and `logEmail()`

---

## PHASE 4: Dentist/Clinic Emails

### Onboarding
- **Welcome email:** ✅ Sent immediately on signup
- **Day 3 reminder:** ✅ Via `send-onboarding-sequence`
- **Day 7 tips:** ✅ Via `send-onboarding-sequence`
- **Onboarding trigger:** ✅ Cron trigger exists (every hour)
- **Bug:** Date mutation in `onboarding-trigger/index.ts` may cause incorrect query bounds

### Lead Notifications
- **Email to clinic:** ✅ Via `lead-email-notification`
- **n8n webhook:** ✅ Via both `lead-notification-trigger` AND `lead-notification-webhook`
- **Issue:** Both trigger functions send to the same n8n webhook → **duplicate external notifications**

### Claim Flow
- **OTP verification:** ✅ Via `send-claim-otp` (SMTP + Resend fallback)
- **Welcome after claim:** ✅ Via `verify-claim-otp`
- **Status updates:** ✅ Via `send-claim-status-update` (uses shared module)

### Form Submissions
- **Dentist notification:** ✅ Via `notify-dentist-submission`
- **Opt-out check:** ✅ Checks `clinic_automation_settings.is_messaging_enabled`

### Billing/Subscription
- **Status:** ❌ **NO billing email notifications exist**
- Stripe webhook processes subscriptions but sends zero emails
- No notification for: subscription activated, payment failed, plan expired

---

## PHASE 5: SuperAdmin Emails

### Status: ❌ COMPLETELY MISSING
- No SuperAdmin notification settings system
- No platform-level email alerts of any kind
- `admin-create-user`: Does NOT notify SuperAdmin
- `admin-send-password-reset`: Does NOT notify SuperAdmin
- Missing notifications: new user signup, new clinic listing, new claim request, failed payment, suspicious activity

---

## PHASE 6: Notification Routing

### Issues Found
1. **Duplicate appointment emails:** `useUpdateAppointment` + direct UI calls can trigger `send-booking-email` twice on status change
2. **Duplicate n8n webhook:** `lead-notification-trigger` + `lead-notification-webhook` send to same URL
3. **Lead notification fails silently:** No fallback when `clinic.email` is null
4. **Free-tier clinics blind:** No notification to dentist when free-tier patient books
5. **No email reminder cron:** `send-email-reminder` exists but never triggered

---

## PHASE 7: Email Logs & Delivery Tracking

### Status: ❌ CRITICAL ISSUES
- **Schema mismatch:** `logEmail()` inserts columns that don't match SQL schema
- **9 functions don't call `logEmail()`:** Most email sends are unlogged
- **No admin UI** for viewing email logs
- **No retry mechanism** for failed sends
- **No resend capability**

Functions missing `logEmail()`: `send-booking-email`, `dentist-signup`, `invite-team-member`, `approve-listing`, `admin-create-user`, `send-claim-otp`, `verify-claim-otp`, `send-review-request`, `review-request-automation`, `send-outreach`, `phase3-outreach`, `admin-send-password-reset`, `test-resend-email`, `send-listing-confirmation`

---

## PHASE 8: Notification Settings

### Clinic Automation Settings
- **Status:** ✅ Table exists with reminder/review/messaging toggles
- **Admin UI:** ✅ `MessagingControlTab.tsx` for per-clinic management
- **Dentist UI:** ✅ `NotificationSettingsCard.tsx` for notifications config
- **Issue:** `notification_config` JSONB column referenced by frontend may not exist in schema

### Patient Notification Preferences
- **Status:** ❌ No patient notification preferences exist

### SuperAdmin Notification Preferences
- **Status:** ❌ No SuperAdmin notification system exists

---

## PHASE 9: Timezone/Date/Link Validation

### Timezone Handling: ❌ NONE
- `toLocaleDateString('en-US')` called without timezone → uses server UTC
- `preferred_date` stored as `text` (no timezone)
- `start_datetime` is `timestamptz` but never used in email rendering

### Hardcoded URLs
- `_shared/email.ts` has `SITE_URL = "https://www.appointpanda.com"` hardcoded
- `notify-dentist-submission` hardcodes `dashboardUrl`
- `send-form-request` hardcodes `baseUrl`
- `verify-claim-otp` hardcodes dashboard URL
- No `localhost` references found ✅

### SITE_URL vs NEXT_PUBLIC_SITE_URL
- Most functions use `Deno.env.get('SITE_URL')` ✅
- `dentist-signup`, `invite-team-member`, `admin-create-user` use `NEXT_PUBLIC_SITE_URL` ⚠️

---

## PHASE 10: Automation Timing

### Cron Triggers
- **Onboarding:** Every hour ✅ (commented SQL)
- **Review automation:** Daily at 9AM ✅
- **Appointment reminder (SMS):** Scheduled ✅
- **Appointment reminder (email):** ❌ No schedule

### Deduplication
- Appointment reminders: ✅ `appointment_reminders` table + unique indexes
- Onboarding: ✅ Checks `email_logs` before sending
- Review automation: ✅ Checks `review_automation_log`
- **Cancelled appointments:** Correctly filtered out (only `pending`/`confirmed`)

### Bugs
- **Onboarding trigger date mutation:** `day7.setDate()` mutates original date, causing incorrect query bounds
- **Double booking email:** `useUpdateAppointment` + UI component both call `send-booking-email`

---

## PHASE 11: Security & Compliance

### Critical: Plaintext Passwords in Emails
1. `admin-create-user/index.ts:183` - `${password}` in email body
2. `approve-listing/index.ts:270` - `Temporary Password: ${tempPassword}`
3. `generateApprovalCredentialsHTML` (email.ts:455) - password in `<code>` block
4. `dentist-signup/index.ts` - password passed as `tempPassword`

### Token Security
- OTP: 6-digit, expires 10 min ✅
- Team invites: 7-day expiry ✅
- Password reset: 24-hour expiry (admin), 1-hour (shared template) ✅
- Old OTP reuse: Handled by status check ✅

### Unsubscribe
- **Table exists:** `email_unsubscribes` ✅
- **Enforced:** ❌ No edge function checks this table before sending
- **Outreach emails include links:** ✅ But endpoint not implemented

### Transactional vs Marketing
- **Status:** ❌ No distinction implemented
- All emails treated equally; no bypass for transactional emails

---

## PHASE 12: Testing Matrix

### Email Type Inventory

| # | Email Type | Trigger | Recipient | Template Source | Uses logEmail? | Status |
|---|-----------|---------|-----------|----------------|---------------|--------|
| 1 | Welcome - Dentist Signup | Signup completion | Dentist | Shared (email.ts) | ❌ | 🛠 Missing log |
| 2 | Welcome - Admin Create | Admin creates user | New user | Inline | ❌ | 🛠 Plaintext password |
| 3 | Welcome - Claim OTP Success | Claim verified | User | Inline | ❌ | 🛠 Inline, no log |
| 4 | Booking - New | Patient books | Patient | Inline | ❌ | 🛠 No log, no AP branding |
| 5 | Booking - Confirmed | Status change | Patient | Inline | ❌ | 🛠 Same as above |
| 6 | Booking - Cancelled | Status change | Patient | Inline | ❌ | 🛠 Same as above |
| 7 | Booking - Completed | Status change | Patient | Inline | ❌ | 🛠 Same as above |
| 8 | Booking - No Show | Status change | Patient | Inline | ❌ | 🛠 Same as above |
| 9 | Email Reminder | NOT TRIGGERED | Patient | Shared (email.ts) | ✅ | ❌ No cron trigger |
| 10 | Review Request (Manual) | Dentist action | Patient | Inline | ❌ | 🛠 No log, no AP branding |
| 11 | Review Request (Auto) | Cron (daily 9AM) | Patient | Inline | ❌ | 🛠 No log, no AP branding |
| 12 | Lead Notification | Lead submitted | Clinic | Shared (email.ts) | ✅ | ✅ |
| 13 | Claim OTP | Claim initiated | Clinic owner | Inline | ❌ | 🛠 Hardcoded 2024 year |
| 14 | Claim Status Update | Admin action | User | Shared (email.ts) | ✅ | ✅ |
| 15 | Onboarding Day 0 | Cron (hourly) | Dentist | Shared (email.ts) | ✅ | ✅ |
| 16 | Onboarding Day 3 | Cron (hourly) | Dentist | Shared (email.ts) | ✅ | ✅ |
| 17 | Onboarding Day 7 | Cron (hourly) | Dentist | Shared (email.ts) | ✅ | ✅ |
| 18 | Profile Completion Reminder | NOT TRIGGERED | Dentist | Shared (email.ts) | ✅ | ❌ No trigger |
| 19 | Form Submission Notice | Patient submits form | Clinic | Inline | ✅ | 🛠 No AP branding |
| 20 | Form Request to Patient | Dentist sends form | Patient | Inline | ✅ | 🛠 No AP branding |
| 21 | Team Invitation | Dentist invites | Team member | Inline | ❌ | 🛠 No log, bypasses shared |
| 22 | Password Reset (Admin) | Admin action | User | branding.ts wrapper | ❌ | 🛠 No log |
| 23 | Listing Confirmation | Dentist submits | Dentist | branding.ts wrapper | ❌ | 🛠 No log |
| 24 | Listing Approved | Admin approves | Dentist | branding.ts wrapper | ❌ | 🛠 Plaintext password |
| 25 | Test Email | Admin test | Admin | Inline | ❌ | ✅ Acceptable |
| 26 | Outreach Campaign | Admin campaign | Multiple | DB templates | ❌ | 🛠 SMTP not logged |
| 27 | Phase 3 Outreach | Admin campaign | Dentists | DB templates | ❌ | 🛠 Only queues, no send |

### Legend
- ✅ Working correctly
- 🛠 Partially working (has issues)
- ❌ Broken/missing

---

## PHASE 13: Priority Implementation Plan

### CRITICAL - Fix Immediately

| Priority | Issue | Files | Fix |
|----------|-------|-------|-----|
| P0 | Schema mismatch: `logEmail()` columns don't match `email_logs` table | `email.ts:106`, SQL schema files | Add migration to add missing columns (`email_type`, `error`, `resend_id`, `user_id`) or fix `logEmail()` to match existing schema |
| P0 | 14 functions don't call `logEmail()` | Multiple | Add `logEmail()` call after every `sendEmail()`/Resend API call |
| P0 | Plaintext passwords in emails | `admin-create-user`, `approve-listing`, `email.ts` (template) | Remove password from email body; send password reset link instead |
| P0 | Email reminder function never triggered | `send-email-reminder` | Add to `appointment-reminder-trigger` cron or create separate cron |

### HIGH - This Week

| Priority | Issue | Files | Fix |
|----------|-------|-------|-----|
| P1 | 6 shared templates are dead code | `email.ts` | Either remove dead templates or migrate inline users to shared templates |
| P1 | Sender address `noreply` vs `no-reply` inconsistency | Multiple | Standardize on `no-reply@appointpanda.com` |
| P1 | No reply-to on any email | All callers | Pass clinic/business reply-to in shared `sendEmail()` options |
| P1 | Hardcoded `SITE_URL` in shared module | `email.ts:5` | Read from `Deno.env.get('SITE_URL')` like other functions |
| P1 | Free-tier clinics get no booking notification | `send-booking-email` | Add optional notification for free-tier clinics (or at minimum log for admin review) |

### MEDIUM - This Month

| Priority | Issue | Files | Fix |
|----------|-------|-------|-----|
| P2 | Duplicate `send-booking-email` on status change | `useAdminAppointments.ts`, `AppointmentsTab.tsx` | Add dedup check or ensure only one call path |
| P2 | Duplicate n8n webhook calls | `lead-notification-trigger` + `lead-notification-webhook` | Consolidate to single trigger |
| P2 | Onboarding trigger date mutation bug | `onboarding-trigger/index.ts` | Fix Date mutation logic |
| P2 | No timezone handling in appointment emails | `send-booking-email`, `send-email-reminder` | Use clinic timezone or patient timezone |
| P2 | Missing SuperAdmin notification system | - | Create SuperAdmin notification preferences and alert system |
| P2 | Missing billing email notifications | `stripe-webhook` | Add emails for subscription events, payment failures |

### LOW - Ongoing

| Priority | Issue | Files | Fix |
|----------|-------|-------|-----|
| P3 | No admin UI for email logs | - | Create email log viewer in admin panel |
| P3 | No email retry mechanism | - | Add simple retry queue (e.g., retry 3x with backoff) |
| P3 | Unsubscribe not enforced | All functions | Add `email_unsubscribes` check before sending non-transactional emails |
| P3 | No transactional vs marketing distinction | - | Add `is_transactional` flag to email metadata |
| P3 | No SPF/DKIM/DMARC documentation | - | Document Resend domain verification requirements |
| P3 | `send-profile-completion-reminder` not triggered | - | Add to onboarding-trigger or create separate cron |

---

## Summary

- **Total email types:** 27 (25 functional + 2 outreach)
- **Working correctly:** 5 (Lead Notification, Onboarding 0/3/7, Claim Status)
- **Partially working:** 17 (missing logging, branding, or support links)
- **Broken/missing:** 5 (email reminder not triggered, profile completion not triggered, missing billing, missing SuperAdmin, missing patient signup)
- **Security issues:** 4 (plaintext passwords)
- **Critical schema mismatch:** 1 (email_logs columns)
- **Duplicate implementations:** 7 concepts have 2+ versions
- **Dead code:** 6 shared templates unused
