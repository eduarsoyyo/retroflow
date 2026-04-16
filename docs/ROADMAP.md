# Revelio — Product Roadmap

## Visión

Revelio es la plataforma que hace visible lo invisible en la gestión de servicios tecnológicos.
No es solo retrospectivas. Es el sistema nervioso del servicio.

---

## Estado actual (v3.0)

| Módulo | Estado | Cobertura |
|--------|--------|-----------|
| Retrospectivas (6 fases) | ✅ Producción | Completo |
| Seguimiento de tareas | ✅ Producción | Completo |
| Gestión de riesgos/problemas/oportunidades | ✅ Producción | Completo |
| Heatmap de criticidad | ✅ Producción | Completo |
| Escalado (4 niveles) | ✅ Producción | Completo |
| Skill Matrix (perfiles + encaje + gaps) | ✅ Producción | Completo |
| Plan de formación | ✅ Producción | Básico |
| Vacaciones y ausencias | ✅ Producción | Completo |
| Organigrama | ✅ Producción | Básico |
| Dashboard global (salud) | ✅ Producción | Completo |
| Centro de Control (maestros) | ✅ Producción | Completo |
| Celebración de fin de retro | ✅ Producción | Efecto completo |
| Notificaciones in-app | ✅ Producción | Básico |
| PDF export | ✅ Producción | Completo |

---

## Fase actual: Robustecimiento (v3.1)

**Objetivo**: de prototipo funcional a producto profesional.

### Arquitectura
- [ ] Migrar a Vite + TypeScript + 3 capas
- [ ] domain/ con 90%+ coverage
- [ ] CI/CD con GitHub Actions
- [ ] Env vars (no más keys en cliente)

### Seguridad
- [ ] Supabase Auth real (email/password)
- [ ] RLS policies por usuario y rol
- [ ] SM/Admin verificado server-side

### Calidad
- [ ] Zod validation en data layer
- [ ] Result<T,E> en todas las operaciones
- [ ] Error boundaries en UI
- [ ] Logger estructurado

### Estabilidad
- [ ] Separar BBDD dev/prod
- [ ] Tests E2E para flujos críticos (crear retro, escalar riesgo)
- [ ] Monitoring básico (errores en producción)

---

## v3.2 — Impacto cross-proyecto

**El feature más valioso del backlog.**

### Problema
Eduardo está asignado al 100% en VWFS. Le asignan una tarea en Endesa.
Hoy nadie se entera del conflicto hasta que algo falla.

### Solución
Revelio ya tiene los datos (FTEs por perfil, tareas con owner, rooms por persona).
Falta conectarlos.

### Diseño

```
┌─ Eduardo Ybarra ────────────────────────┐
│ Asignación: VWFS 1.0 FTE               │
│                                          │
│ ⚠️ Conflicto detectado:                 │
│ • 5 tareas abiertas en VWFS (3 vencen)  │
│ • 2 tareas nuevas asignadas en Endesa   │
│ • Carga estimada: 1.4 FTE (140%)        │
│                                          │
│ Impacto en VWFS:                         │
│ • SLA de respuesta: riesgo de breach    │
│ • Sprint velocity: -30% estimado         │
│                                          │
│ Recomendación:                           │
│ • Reasignar tareas Endesa a Miguel      │
│ • O reducir scope Sprint VWFS           │
└──────────────────────────────────────────┘
```

### Implementación
- `domain/capacity.ts` — cálculo de carga por persona cross-proyecto
- `services/capacity.ts` — detectar conflictos, generar alertas
- Badge en dashboard: "3 personas sobrecargadas"
- Vista en Personas: barra de carga con desglose por proyecto

---

## v3.3 — Predicción de entrega

### Problema
"¿Vamos a entregar a tiempo?" — hoy se responde con intuición.

### Solución
Calcular probabilidad de entrega basada en:
- Velocidad histórica del equipo (tareas completadas/semana)
- Tareas restantes + complejidad estimada
- Disponibilidad real (vacaciones, carga cross-proyecto)
- Riesgos activos en sector crítico

### Diseño
```
Sprint 5 — Entrega: 28 abr 2026

Probabilidad de completar todo: 62%  🟡

Escenarios:
├── Optimista (todo OK):     95% → 25 abr ✅
├── Probable (ritmo actual): 62% → 30 abr ⚠️
└── Pesimista (con riesgos): 35% → 5 may  🔴

Factores de riesgo:
• Eduardo al 140% FTE (-15% velocity)
• R3 "Integración API" sin mitigar (-10%)
• Cecilia de vacaciones 21-25 abr (-8%)
```

### Implementación
- `domain/prediction.ts` — simulación basada en distribución triangular (no hace falta Montecarlo completo)
- Input: velocity últimos 3 sprints + backlog restante + calendario equipo
- Output: % probabilidad + fecha estimada por escenario

---

## v3.4 — Métricas automáticas avanzadas

### Problema
El SM dedica 2h/semana a preparar el status report manualmente.

### Solución
Revelio ya tiene todos los datos. Auto-generar:
- Status report semanal (PDF/email)
- Trend de salud por proyecto (gráfica 12 semanas)
- Alertas proactivas ("El proyecto X lleva 3 semanas degradándose")
- Benchmarking entre proyectos ("VWFS resuelve riesgos 2x más rápido que Endesa")

---

## v4.0 — Gamificación completa

### Diseñado, pendiente de implementar

- Celebraciones por calidad de retro (Nox / Lumos / Revelio / Patronum)
- Logros individuales estilo Hogwarts
- Scoring system por participación, resolución de riesgos, formación completada
- Leaderboard de equipos

---

## Backlog de ideas (sin priorizar)

| Idea | Valor | Esfuerzo | Estado |
|------|-------|----------|--------|
| Integración con Jira (sync tareas) | Alto | Alto | Idea |
| Slack notifications | Medio | Medio | Idea |
| Mobile responsive (PWA) | Alto | Medio | Parcial |
| Multi-idioma (i18n) | Bajo | Medio | Idea |
| Dark mode | Bajo | Bajo | Idea |
| Export a PowerPoint | Alto | Medio | Idea |
| Integración con calendarios (Outlook/Google) | Medio | Alto | Idea |
| AI assistant (resumen de retro, sugerencias) | Alto | Alto | Idea |
| Custom workflows (no solo retro) | Alto | Alto | Idea |
