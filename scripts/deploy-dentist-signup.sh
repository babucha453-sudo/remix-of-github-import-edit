#!/bin/bash
# Deploy dentist-signup edge function to Supabase
# Run from project root: ./scripts/deploy-dentist-signup.sh

set -e

echo "Deploying dentist-signup edge function..."

cd "$(dirname "$0")/.."

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
    echo "Error: Supabase CLI or npx is required"
    exit 1
fi

# Try supabase CLI first, fall back to npx
SUPABASE_CMD="supabase"
if ! command -v supabase &> /dev/null; then
    echo "Using npx supabase..."
    SUPABASE_CMD="npx supabase"
fi

# Check if linked
if ! $SUPABASE_CMD projects list &> /dev/null 2>&1; then
    echo ""
    echo "=== IMPORTANT: Link your Supabase project first ==="
    echo "Run: npx supabase link --project-ref fnewyocguujowqxyiqsy"
    echo ""
fi

# Deploy the function
echo "Deploying supabase/functions/dentist-signup..."
$SUPABASE_CMD functions deploy dentist-signup --project-ref fnewyocguujowqxyiqsy --no-verify-jwt

echo ""
echo "Done! The signup flow should now work."
echo "If the function fails, check Supabase dashboard → Edge Functions → dentist-signup → Logs"