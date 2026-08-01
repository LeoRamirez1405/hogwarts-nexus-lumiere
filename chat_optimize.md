# Auditoría del Sistema de Mensajería — Hogwarts Nexus Lumiére

> Fecha: 2026-08-01
> Alcance: Frontend (Next.js/React/TypeScript) + Backend (FastAPI/SQLAlchemy)
> Referencia: WhatsApp, Telegram, Signal, Discord

---

## 4. Missing Features vs. Estado del Arte

Features marcadas con ★ son **imprescindibles** para una UX competitiva.

### 4.5 Grupo y Administración

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| ★ Invitar por link | ✅ | ✅ | ✅ | ✅ Corregido 2026-08-01 |
| ★ Eventos en grupo | ✅ (2026) | ✅ | ❌ | Media |
| ★ Voz en grupo (Discord-like) | ✅ | ❌ | ❌ | Media |
| Aprobación de nuevos miembros | ✅ | ✅ | ✅ | ✅ Corregido 2026-08-01 |
| Cambiar admin / roles | ✅ | ✅ | ✅ | ✅ Corregido 2026-08-01 |

### 4.6 Seguridad y Privacidad

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| ★ Cifrado end-to-end | ✅ (default) | ⚠️ (Secret) | ❌ | **Crítica** (depende del contexto) |
| ★ Verificación de seguridad | ✅ | ❌ | ❌ | Media |
| Efectos de mensajes (md-like) | ✅ | ✅ | ✅ | ✅ Corregido 2026-08-01 |

### 4.7 Extras Modernos

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| Link preview (URL unfurling) | ✅ | ✅ | ✅ | ✅ Corregido 2026-08-01 |

---

## 6. Plan de Features Prioritarios

| # | Feature | Esfuerzo | Impacto UX | Dependencia | Estado |
|---|---------|----------|------------|-------------|--------|

| 21 | Invitar por link | 3 días | Alto | — | ✅ Corregido 2026-08-01 |
| 22 | Link preview | 3 días | Alto | httpx | ✅ Corregido 2026-08-01 |

