# Review Request Automation Setup Guide

## Files Created/Modified

### 1. `supabase/functions/review-request-automation/index.ts` (NEW)
Core function that sends review requests after appointments are completed.
- Handles 3-step sequence: Day 0, Day 3, Day 7
- Sends email with star rating quick links (5, 4, 3 stars)
- Includes Google review link and platform review link
- Logs to `review_automation_log` table

### 2. `supabase/functions/review-automation-trigger/index.ts` (NEW)
Cron-triggered function that checks for completed appointments daily.
- Processes Day 0 requests for new completed appointments
- Processes Day 3 reminders for pending requests
- Processes Day 7 final reminders for still pending requests

### 3. `supabase/review-automation.sql` (NEW)
Database migration with:
- `review_automation_log` table for tracking requests
- `automation_run_log` table for monitoring
- New columns on `appointments` table
- Auto-trigger function on appointment completion

### 4. `supabase/functions/send-review-request/index.ts` (MODIFIED)
Enhanced to support:
- Auto-trigger mode via `autoTrigger` flag
- Appointment-based review requests
- Dual logging to both `review_requests` and `review_automation_log`

## Setup Instructions

### Step 1: Run Database Migration
Run `supabase/review-automation.sql` in Supabase SQL Editor:
```sql
-- Copy/paste the entire file content into Supabase SQL Editor and execute
```

### Step 2: Deploy Edge Functions
```bash
supabase functions deploy review-request-automation
supabase functions deploy review-automation-trigger
```

### Step 3: Set Cron Job for Automation Trigger
In Supabase Dashboard > Extensions > pg_cron:
```sql
SELECT cron.schedule(
  'review-automation-trigger',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.functions_url') || '/review-automation-trigger',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Or trigger manually via curl:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/review-automation-trigger \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Step 4: Test the Automation
Manually trigger for a completed appointment:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/review-request-automation \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": "YOUR_APPOINTMENT_UUID", "sequenceStep": 0}'
```

## Review Request Sequence

| Day | Action | Message |
|-----|--------|---------|
| 0 | Initial request | Ask for review with positive feedback link |
| 3 | Reminder | Reminder if no review received |
| 7 | Final reminder | Final chance to leave review |

## Email Content Includes

- Patient name
- Appointment date
- Clinic/dentist name
- Star rating quick links (5⭐, 4⭐, 3⭐)
- Direct link to Google review
- Direct link to AppointPanda platform review
- Custom messaging support

## Tracking

- `review_automation_log`: All automation attempts with status
- `automation_run_log`: Cron execution history
- `appointments.review_status`: Review status (pending, requested, completed, declined)