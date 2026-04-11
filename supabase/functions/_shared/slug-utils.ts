/**
 * Shared utility for generating unique slugs without random codes.
 * Uses business name + counter for uniqueness.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Generate a clean slug from a name (no random codes)
 */
export function generateBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

interface SlugRow {
  slug: string;
}

/**
 * Generate a unique slug by checking the database for existing slugs.
 * If the base slug exists, appends a counter (e.g., "clinic-name-2")
 */
export async function generateUniqueSlug(
  supabaseAdmin: SupabaseClient,
  tableName: 'clinics' | 'dentists',
  name: string
): Promise<string> {
  const baseSlug = generateBaseSlug(name);
  
  if (!baseSlug) {
    // Fallback for empty names
    return `practice-${Date.now().toString(36)}`;
  }

  // Check if base slug exists
  const { data: existing } = await supabaseAdmin
    .from(tableName)
    .select('slug')
    .like('slug', `${baseSlug}%`)
    .order('slug', { ascending: false });

  const rows = (existing || []) as SlugRow[];

  if (rows.length === 0) {
    return baseSlug;
  }

  // Find the highest counter
  let maxCounter = 0;
  const exactMatch = rows.some((row) => row.slug === baseSlug);
  
  if (exactMatch) {
    maxCounter = 1;
  }

  for (const row of rows) {
    const match = row.slug.match(new RegExp(`^${baseSlug}-(\\d+)$`));
    if (match) {
      const counter = parseInt(match[1], 10);
      if (counter >= maxCounter) {
        maxCounter = counter + 1;
      }
    }
  }

  if (maxCounter === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${maxCounter}`;
}
