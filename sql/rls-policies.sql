-- ══════════════════════════════════════════════════════════════
-- REVELIO v2 — RLS Policies (Anillo 1)
-- Run on Supabase DEV: rjuszxhiqqkkizhqtwep
-- 
-- Logic: 
--   - Authenticated users only
--   - team_members: see all (same org, no multi-tenant yet)
--   - rooms: only rooms user is assigned to (via team_members.rooms)
--   - retros/org_chart/tags: only for rooms user has access to
--   - superusers bypass all restrictions
-- ══════════════════════════════════════════════════════════════

-- Helper function: get rooms for current user
CREATE OR REPLACE FUNCTION user_rooms() RETURNS TEXT[] AS $$
  SELECT COALESCE(rooms, '{}') FROM team_members WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: check if current user is superuser
CREATE OR REPLACE FUNCTION is_superuser() RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_superuser, false) FROM team_members WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ═══ 1. TEAM MEMBERS ═══
-- All authenticated users see all team members (needed for assignments, selects)
-- Only superusers can INSERT/UPDATE/DELETE
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_members_all" ON team_members;
DROP POLICY IF EXISTS "tm_select" ON team_members;
DROP POLICY IF EXISTS "tm_modify" ON team_members;

CREATE POLICY "tm_select" ON team_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tm_modify" ON team_members FOR ALL
  USING (is_superuser())
  WITH CHECK (is_superuser());

-- ═══ 2. ROOMS ═══
-- Users see only rooms they're assigned to. Superusers see all.
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rooms_all" ON rooms;
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_modify" ON rooms;

CREATE POLICY "rooms_select" ON rooms FOR SELECT
  USING (is_superuser() OR slug = ANY(user_rooms()));

CREATE POLICY "rooms_modify" ON rooms FOR ALL
  USING (is_superuser())
  WITH CHECK (is_superuser());

-- ═══ 3. RETROS ═══
-- Users see retros for their rooms. Superusers see all.
ALTER TABLE retros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retros_all" ON retros;
DROP POLICY IF EXISTS "retros_select" ON retros;
DROP POLICY IF EXISTS "retros_modify" ON retros;

CREATE POLICY "retros_select" ON retros FOR SELECT
  USING (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "retros_modify" ON retros FOR INSERT
  WITH CHECK (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "retros_update" ON retros FOR UPDATE
  USING (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "retros_delete" ON retros FOR DELETE
  USING (is_superuser());

-- ═══ 4. RETRO METRICS ═══
ALTER TABLE retro_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retro_metrics_all" ON retro_metrics;
DROP POLICY IF EXISTS "rm_select" ON retro_metrics;
DROP POLICY IF EXISTS "rm_modify" ON retro_metrics;

CREATE POLICY "rm_select" ON retro_metrics FOR SELECT
  USING (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "rm_modify" ON retro_metrics FOR ALL
  USING (is_superuser() OR sala = ANY(user_rooms()))
  WITH CHECK (is_superuser() OR sala = ANY(user_rooms()));

-- ═══ 5. ORG CHART ═══
ALTER TABLE org_chart ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_chart_all" ON org_chart;
DROP POLICY IF EXISTS "oc_select" ON org_chart;
DROP POLICY IF EXISTS "oc_modify" ON org_chart;

CREATE POLICY "oc_select" ON org_chart FOR SELECT
  USING (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "oc_modify" ON org_chart FOR ALL
  USING (is_superuser())
  WITH CHECK (is_superuser());

-- ═══ 6. CALENDARIOS ═══
-- All authenticated users can read calendars
ALTER TABLE calendarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendarios_all" ON calendarios;
DROP POLICY IF EXISTS "cal_select" ON calendarios;
DROP POLICY IF EXISTS "cal_modify" ON calendarios;

CREATE POLICY "cal_select" ON calendarios FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "cal_modify" ON calendarios FOR ALL
  USING (is_superuser())
  WITH CHECK (is_superuser());

-- ═══ 7. ADMIN ROLES ═══
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_roles_all" ON admin_roles;
DROP POLICY IF EXISTS "ar_select" ON admin_roles;
DROP POLICY IF EXISTS "ar_modify" ON admin_roles;

CREATE POLICY "ar_select" ON admin_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "ar_modify" ON admin_roles FOR ALL
  USING (is_superuser())
  WITH CHECK (is_superuser());

-- ═══ 8. TAGS ═══
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tags_all" ON tags;
DROP POLICY IF EXISTS "tags_select" ON tags;
DROP POLICY IF EXISTS "tags_modify" ON tags;

CREATE POLICY "tags_select" ON tags FOR SELECT
  USING (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "tags_modify" ON tags FOR ALL
  USING (is_superuser() OR sala = ANY(user_rooms()))
  WITH CHECK (is_superuser() OR sala = ANY(user_rooms()));

-- ═══ 9. TAG ASSIGNMENTS ═══
ALTER TABLE tag_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tag_assignments_all" ON tag_assignments;
DROP POLICY IF EXISTS "ta_select" ON tag_assignments;
DROP POLICY IF EXISTS "ta_modify" ON tag_assignments;

CREATE POLICY "ta_select" ON tag_assignments FOR SELECT
  USING (is_superuser() OR sala = ANY(user_rooms()));

CREATE POLICY "ta_modify" ON tag_assignments FOR ALL
  USING (is_superuser() OR sala = ANY(user_rooms()))
  WITH CHECK (is_superuser() OR sala = ANY(user_rooms()));

-- ══════════════════════════════════════════════════════════════
-- ✅ RLS Policies active.
-- - Regular users: see their rooms + all team members + calendars
-- - Superusers: see and modify everything
-- - Unauthenticated: see nothing
-- ══════════════════════════════════════════════════════════════
