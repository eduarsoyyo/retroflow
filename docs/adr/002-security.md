# ADR-002: Seguridad y autenticación

**Estado**: Planificado  
**Fecha**: 2026-04-14

## Estado actual (INSEGURO)

- Anon key de Supabase hardcoded en cliente
- RLS policies "Allow all" en todas las tablas
- Login "de guardería" sin auth real
- Sin CSRF, rate limiting, ni input sanitization

## Plan de mejora (por prioridad)

### P0 — Inmediato
- [x] Mover keys a env vars (VITE_SUPABASE_*)
- [ ] .env.example sin secretos reales
- [ ] .gitignore incluye .env*

### P1 — Antes de usuarios reales
- [ ] Supabase Auth con email/password
- [ ] `team_members.auth_id` → `auth.users.id`
- [ ] RLS policies reales:
  ```sql
  -- Solo ver datos de tus proyectos
  CREATE POLICY "Members see own rooms" ON retros
    FOR SELECT USING (
      sala IN (
        SELECT unnest(rooms) FROM team_members 
        WHERE auth_id = auth.uid()
      )
    );
  ```
- [ ] SM/Admin verificado server-side (no solo frontend flag)

### P2 — Producción
- [ ] Edge Functions para operaciones sensibles
- [ ] Input validation con Zod en server
- [ ] Rate limiting en API
- [ ] Audit log de cambios críticos
- [ ] CSP headers en Netlify

### P3 — Enterprise
- [ ] SSO / SAML
- [ ] MFA
- [ ] Data encryption at rest
- [ ] GDPR compliance (export/delete user data)
