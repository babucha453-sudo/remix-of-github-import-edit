# Email Notification System Audit Report — AppointPanda

## 1. Email Configuration Report

| Setting | Value | Status |
|---------|-------|--------|
| **Provider** | Resend (SMTP + HTTP API) | ✅ Configured |
| **SMTP Host** | `smtp.resend.com:465` | ✅ Verified working |
| **SMTP Username** | `resend` | ✅ Correct |
| **From Email** | `no-reply@appointpanda.com` | ✅ Configured |
| **From Name** | `Appoint Panda` | ✅ Configured |
| **Edge Functions** | 20+ functions via `_shared/email.ts` (Resend HTTP API) | ✅ Working |
| **Superset Auth Emails** | 4 HTML templates deployed via Management API | ✅ Deployed |
| **Email Logging** | `email_logs` table with structured logging | ✅ Working |
| **SPF/DKIM/DMARC** | Managed by Resend | ⚠️ Not verified |

### Issues
- 🔴 **Live API key in config.toml**: `re_Fnh9mz5C_BkxFuDMLuAVJPkMjZnGAkywg` is hardcoded in `supabase/config.toml:357`
- 🔴 **No RESEND_API_KEY in .env**: Only set in Supabase dashboard, not in local dev
- 🟡 **Dual email sending paths**: Shared `sendEmail()` (HTTP API) + `admin-send-password-reset` (Resend SDK) + `send-claim-otp` (SMTP fallback)

---

## 2. Email Template Report

### Supabase Auth Templates (4) — `supabase/templates/`

| Template | File | Status | Issues |
|----------|------|--------|--------|
| Password Recovery | `recovery.html` | ✅ Deployed | 🔴 Text-only logo, no image; color mismatch (#1a8a7a vs #0d9488) |
| Email Confirmation | `confirmation.html` | ✅ Deployed | 🔴 Same text-only logo, color mismatch |
| Team Invite | `invite.html` | ✅ Deployed | 🔴 Same issues; duplicate with richer `invite-team-member` edge fn |
| Magic Link | `magic_link.html` | ✅ Deployed | 🔴 Same issues |

### Shared Programmatic Templates (13) — `supabase/functions/_shared/email.ts`

| Template | Status | Branding | Logo | CTA | Footer |
|----------|--------|----------|------|-----|--------|
| Booking Email (7 sub-types) | ✅ | Full | Yes (clinic) | Multi | Full |
| Welcome Email | ✅ | Full | Yes | Complete Profile | Full |
| Review Request | ✅ | Full | Yes (clinic) | Leave Review | Full |
| Lead Notification | ✅ | Full | Yes (clinic) | View Lead | Full |
| Password Reset | ✅ | Full | No | Reset Password | Full |
| Claim Success | ✅ | Full | Yes (clinic) | Dashboard | Full |
| Team Invite | ✅ | Full | No | Accept | Full |
| Listing Confirmation | ✅ | Full | No | Track Status | Full |
| Approval Credentials | ✅ | Full | No | Dual CTA | Full |
| Appointment Reminder | ✅ | Full | Yes (clinic) | Manage | Full |
| Claim Status Update | ✅ | Full | No | Conditional | Full |
| Onboarding (Day 0/3/7) | ✅ | Full | No | Varies | Full |
| Profile Completion | ✅ | Full | No | Complete Profile | Full |

### Standalone Inline Templates (6) — Individual Edge Functions

| Template | Status | Branding | Issues |
|----------|--------|----------|--------|
| Form Request (`send-form-request`) | 🟡 | Minimal | 🔴 No logo, no support email in footer |
| Form Submission Notification (`notify-dentist-submission`) | 🟡 | Minimal | 🔴 No logo, no support email in footer |
| Claim OTP (`send-claim-otp`) | 🟡 | Minimal | 🔴 No logo, no support email, **copyright 2024 (stale)** |
| Listing Approval (`approve-listing`) | ✅ | Full | Via `branding.ts` wrapper |
| Admin Password Reset (`admin-send-password-reset`) | ✅ | Full | Via `branding.ts` wrapper |
| Review Automation (`review-request-automation`) | 🟡 | Partial | Inline HTML, partial branding |

### Global Template Issues
- 🔴 **No email preheader text** in any template (email preview text in inbox)
- 🟡 **No `{{ .Token }}` fallback** in Supabase auth templates
- 🟡 **Missing preheader hidden text blocks** for better inbox preview rendering
- 🟡 **4 auth templates are single-line minified** — hard to maintain

---

## 3. Patient Email Workflow Report

| Flow | Emails | Status | Recipient | Notes |
|------|--------|--------|-----------|-------|
| **Signup** | Welcome / confirmation | ✅ | Patient | Via Supabase auth (signUp) or edge function (dentist-signup) |
| **Password Reset** | Reset link | ✅ | Patient | Via `Auth.tsx` → `supabase.auth.resetPasswordForEmail()` |
| **Booking** | Confirmation (7 status types) | ✅ | Patient | `send-booking-email` edge function, fire-and-forget |
| **Booking Reminder** | 24h reminder | ✅ | Patient | `appointment-reminder-trigger` cron via `send-email-reminder` |
| **Review Request** | Review invitation | ✅ | Patient | Manual (`ReputationSuite.tsx`) + automated (`review-automation-trigger`) |
| **Patient Form** | Form request email | ✅ | Patient | `send-form-request` edge function |
| **Booking Cancel** | Cancellation notice | ✅ | Patient | Via `send-booking-email` with `cancelled` status |

### Patient Email Gaps
- 🟡 **No "password changed" notification** for patients
- 🟡 **No email change verification** — `secure_email_change = true` in config
- 🟡 **No login alert emails** (not implemented anywhere)

---

## 4. Dentist/Clinic Email Workflow Report

| Flow | Emails | Status | Recipient | Notes |
|------|--------|--------|-----------|-------|
| **Dentist Signup** | Welcome + credentials | ✅ | Dentist | `dentist-signup` / `send-welcome-email` edge functions |
| **Listing Submitted** | Confirmation | ✅ | Dentist | `send-listing-confirmation` edge function |
| **Listing Approved** | Approval + login creds | ✅ | Dentist | `approve-listing` edge function |
| **New Lead** | Lead notification | ✅ | Clinic | `lead-email-notification` edge function |
| **Form Submission** | Form submission alert | ✅ | Dentist | `notify-dentist-submission` edge function |
| **Claim Status** | Approved/rejected update | ✅ | Claimant | `send-claim-status-update` edge function |
| **Team Invite** | Invitation email | ✅ | Invitee | `invite-team-member` edge function |
| **Profile Completion** | Reminder to complete | ✅ | Dentist | `send-profile-completion-reminder` edge function |
| **Onboarding** | Day 0/3/7 sequence | ✅ | Dentist | `send-onboarding-sequence` + `onboarding-trigger` cron |

### Dentist Email Gaps
- 🔴 **No new review notification** to dentist when patient leaves a review
- 🔴 **No negative feedback alert** — though `NotificationSettingsCard.tsx` has the UI toggle (`notify_negative_feedback`)
- 🟡 **No reputation score drop alert**
- 🟡 **No duplicate email deduplication** in booking forms (3 parallel booking components all fire-and-forget)

---

## 5. SuperAdmin Email Workflow Report

| Flow | Status | Notes |
|------|--------|-------|
| **New user signup** | ❌ Missing | No SuperAdmin notification |
| **New dentist signup** | ❌ Missing | No SuperAdmin notification |
| **New clinic listing** | ❌ Missing | No SuperAdmin notification |
| **New claim request** | ❌ Missing | No SuperAdmin notification |
| **New support ticket** | ❌ Missing | No support ticket system exists |
| **Failed email delivery** | ❌ Missing | No alert on `email_logs` failures |
| **Failed integration** | ❌ Missing | No webhook failure alerts |
| **AI job failed** | ❌ Missing | No alerting |
| **Payment event** | ❌ Missing | No billing system notifications |
| **Suspicious activity** | ❌ Missing | No security alerting |

**No SuperAdmin email notification system exists.** SuperAdmins can view audit logs and system status in the admin dashboard, but receive no proactive email notifications.

---

## 6. Notification Routing Report

### Routing Rules

| Sender → Recipient | Rule | Status |
|--------------------|------|--------|
| Patient booking → Patient | Booking confirmation via patient email | ✅ Working |
| Admin status change → Patient | Status update via appointment email | ✅ Working |
| Lead form → Clinic | Lead notification via clinic.email | ✅ Working |
| Form submission → Dentist | Submission alert via clinic/claimed_by email | ✅ Working |
| Claim status → Claimant | Status update via user email | ✅ Working |
| Team invite → Invitee | Invitation via entered email | ✅ Working |

### Routing Issues
- 🟡 **Three parallel dentist notification UIs** write to different tables (`dentist_settings` vs `clinic_automation_settings`), potential inconsistency
- 🟡 **No fallback chain** for clinic email — if `clinic.email` is null, lead notifications silently fail
- 🟡 **Booking email errors silently swallowed** in `InlineBookingCalendar.tsx` (`.catch(() => {})`)
- 🟡 **No duplicate prevention** — patient can receive 3 booking confirmation emails if they try 3 booking methods

---

## 7. Email Logs Report

### Current State
| Metric | Status |
|--------|--------|
| `email_logs` table | ✅ Exists with structured schema |
| `logEmail()` utility | ✅ Used by all shared edge functions |
| Log fields | recipient, subject, type, status, error_message, resend_id, clinic_id, user_id, appointment_id |
| **Admin UI viewer** | ❌ **No UI exists** to view email logs |
| Retry mechanism | ❌ None — failed sends are logged but never retried |
| Delivery tracking | ❌ No delivery/open/click tracking |

### Schema
```sql
email_logs:
  id (uuid, PK)
  recipient (text)
  subject (text)
  type (text)
  status (text)
  error_message (text, nullable)
  sent_at (timestamptz, default now())
  resend_id (text, nullable)
  clinic_id (uuid, nullable)
  user_id (uuid, nullable)
  appointment_id (uuid, nullable)
```

---

## 8. Broken Emails List

| # | Email | Issue | Severity |
|---|-------|-------|----------|
| 1 | **Claim OTP** | Hardcoded "© 2024" copyright (should be dynamic) | 🟡 Medium |
| 2 | **Form Request** | No support email in footer, no logo | 🟡 Medium |
| 3 | **Form Submission Notification** | No support email in footer, no logo | 🟡 Medium |
| 4 | **Supabase Auth templates** | Text-only logo, wrong teal color (#1a8a7a vs #0d9488) | 🟡 Medium |
| 5 | **Booking email (InlineBookingCalendar)** | Error silently swallowed `.catch(() => {})` | 🔴 High |
| 6 | **Lead notification** | No fallback if clinic.email is null | 🟡 Medium |

---

## 9. Missing Emails List

| # | Email | Missing For | Priority |
|---|-------|-------------|----------|
| 1 | **New user signup notification** | SuperAdmin | 🔴 High |
| 2 | **New dentist signup notification** | SuperAdmin | 🔴 High |
| 3 | **New clinic listing notification** | SuperAdmin | 🔴 High |
| 4 | **New claim request notification** | SuperAdmin | 🔴 High |
| 5 | **New review notification** | Dentist (when patient leaves review) | 🔴 High |
| 6 | **Negative feedback alert** | Dentist (toggle exists, no trigger) | 🔴 High |
| 7 | **Failed email delivery alert** | SuperAdmin | 🟡 Medium |
| 8 | **Password changed notification** | Patient/Dentist | 🟡 Medium |
| 9 | **Email changed notification** | Patient/Dentist | 🟡 Medium |
| 10 | **Login alert** | Patient/Dentist | 🟢 Low |
| 11 | **Reputation score drop alert** | Dentist | 🟢 Low |
| 12 | **Support ticket notification** | SuperAdmin/Support | 🟢 Low |

---

## 10. Duplicate Email Issue List

| # | Issue | Details |
|---|-------|---------|
| 1 | **3 dentist notification preference UIs** | `NotificationPreferencesTab.tsx`, `NotificationSettingsCard.tsx`, `DentistSettingsTab.tsx` — all control similar settings, write to different tables |
| 2 | **2 team invite templates** | Supabase auth `invite.html` + `generateTeamInviteHTML()` — different templates for different invite paths |
| 3 | **3 password reset paths** | Supabase auth `recovery.html` + `generatePasswordResetHTML()` in `_shared/email.ts` + inline in `admin-send-password-reset` |
| 4 | **3 booking form components** | `CalendarBookingForm.tsx`, `ZocdocBookingForm.tsx`, `InlineBookingCalendar.tsx` — each independently invokes `send-booking-email` |

---

## 11. Security Issue List

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | **Live Resend API key in config.toml** | 🔴 Critical | `re_Fnh9mz5C_BkxFuDMLuAVJPkMjZnGAkywg` visible in plaintext |
| 2 | **No domain authentication verified** | 🟡 Medium | SPF/DKIM/DMARC records for `appointpanda.com` not confirmed |
| 3 | **No unsubscribe page** | 🟡 Medium | `https://appointpanda.com/unsubscribe` returns 404 (placeholder URL) |
| 4 | **Silent error swallowing** | 🟡 Medium | `InlineBookingCalendar.tsx` `.catch(() => {})` hides email failures |
| 5 | **No rate limiting visible** | 🟡 Medium | No throttling on email-sending edge functions |
| 6 | **No email sending audit for SuperAdmin** | 🟡 Medium | No UI to review all email activity |

---

## 12. Recommended Fixes (Priority Order)

### P0 — Critical (fix immediately)
1. **Remove live API key from config.toml** — replace with env var reference
2. **Add `.catch()` error logging** to `InlineBookingCalendar.tsx` line 308 (currently silently swallows)

### P1 — High (fix within sprint)
3. **Replace text-only logo in 4 Supabase auth templates** with image logo from branding
4. **Fix copyright year** in `send-claim-otp/index.ts` — make dynamic or update to 2026
5. **Add support email + logo** to `send-form-request` and `notify-dentist-submission` templates via branding.ts
6. **New review notification to dentist** — Trigger `send-booking-email`-style notification when review inserted
7. **Negative feedback alert to dentist** — Wire up the existing `notify_negative_feedback` toggle in `NotificationSettingsCard.tsx`

### P2 — Medium (fix within 2 sprints)
8. **SuperAdmin notification system** — Add basic email alerts for new signups, listings, claims
9. **Email logs admin viewer** — Add tab to admin panel rendering `email_logs` table
10. **Add preheader text** to all email templates for better inbox preview
11. **Create `/unsubscribe` page** — Basic unsubscribe form linked from outreach emails
12. **Normalize colors** across all templates (#0d9488 instead of #1a8a7a)

### P3 — Low (nice to have)
13. **Unify dentist notification settings** into single source of truth
14. **Add delivery/open tracking** via Resend webhooks
15. **Add retry mechanism** for failed email sends
16. **Password changed/email changed notifications** for patients
17. **Add `{{ .Token }}` fallback** to Supabase auth templates

---

## 13. Priority Implementation Plan

```
Sprint 1 (Security + Bug Fixes):
  ├── P0: Remove API key from config.toml
  ├── P0: Fix silent error swallowing in InlineBookingCalendar.tsx
  ├── P1: Fix copyright year in send-claim-otp
  └── P1: Add support email + logo to missing templates

Sprint 2 (Missing Features):
  ├── P1: New review notification to dentist
  ├── P1: Negative feedback alert
  ├── P2: SuperAdmin basic notifications
  └── P2: Email logs admin viewer

Sprint 3 (Polish):
  ├── P2: Auth template branding overhaul (logo + color)
  ├── P2: Preheader text on all templates
  ├── P2: Create /unsubscribe page
  └── P3: Unify notification settings

Sprint 4 (Advanced):
  ├── P3: Delivery/open tracking
  ├── P3: Retry mechanism
  ├── P3: Password/email changed notifications
  └── P3: Token fallback in auth templates
```
