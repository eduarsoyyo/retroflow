// ═══ EXPORT PROD → DEV — Run locally: node export-prod-to-dev.js ═══
// Reads all tables from PROD Supabase, writes to DEV Supabase.
// Run from the revelio project root.

const { createClient } = require('@supabase/supabase-js');

const PROD = createClient(
  'https://lvsfrynsnyofroscaxhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2c2ZyeW5zbnlvZnJvc2NheGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDcxMDEsImV4cCI6MjA5MDUyMzEwMX0.lJfuqjd1VcZyJmZD0pDF_tI4lytohpAwwaaOjxVmuKY'
);

const DEV = createClient(
  'https://etyjtzpjvlgcxlxjrbhj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0eWp0enBqdmxnY3hseGpyYmhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjI2NjYsImV4cCI6MjA5MTczODY2Nn0.SFJro3VrB9vKpOer1AGDQTIZ7BfHh_LumTauoPBVVos'
);

const TABLES = [
  'team_members',
  'rooms',
  'retros',
  'retro_metrics',
  'org_chart',
  'tags',
  'tag_assignments',
  'skill_profiles',
  'skills',
  'profile_skills',
  'member_skills',
  'member_profiles',
  'skill_actions',
  'training_catalog',
  'admin_roles',
  'admin_calendars',
];

async function exportTable(table) {
  const { data, error } = await PROD.from(table).select('*');
  if (error) {
    console.log(`  ⚠ ${table}: ${error.message}`);
    return 0;
  }
  if (!data || data.length === 0) {
    console.log(`  · ${table}: vacía`);
    return 0;
  }

  // Clear dev table first
  // Use a broad delete (all rows)
  try {
    await DEV.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  } catch {
    // Some tables may not have 'id' column, try alternative
    try {
      await DEV.from(table).delete().gte('created_at', '1900-01-01');
    } catch {}
  }

  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < data.length; i += 50) {
    const batch = data.slice(i, i + 50);
    const { error: insertErr } = await DEV.from(table).upsert(batch, { onConflict: 'id' });
    if (insertErr) {
      // Try insert without upsert
      const { error: insertErr2 } = await DEV.from(table).insert(batch);
      if (insertErr2) {
        console.log(`  ⚠ ${table} batch ${i}: ${insertErr2.message}`);
      } else {
        inserted += batch.length;
      }
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ✓ ${table}: ${inserted}/${data.length} registros`);
  return inserted;
}

async function main() {
  console.log('═══ REVELIO: Export PROD → DEV ═══\n');
  console.log('PROD: lvsfrynsnyofroscaxhl.supabase.co');
  console.log('DEV:  etyjtzpjvlgcxlxjrbhj.supabase.co\n');

  let total = 0;
  for (const table of TABLES) {
    total += await exportTable(table);
  }

  console.log(`\n═══ Total: ${total} registros exportados ═══`);
}

main().catch(e => console.error('Error:', e));
