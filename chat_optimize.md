# Auditoría del Sistema de Mensajería — Hogwarts Nexus Lumiére

> Fecha: 2026-07-30
> Alcance: Frontend (Next.js/React/TypeScript) + Backend (FastAPI/SQLAlchemy)
> Referencia: WhatsApp, Telegram, Signal, Discord

---

## 4. Missing Features vs. Estado del Arte

Features marcadas con ★ son **imprescindibles** para una UX competitiva.

### 4.2 Mensajes

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| Mensajes programados | ❌ | ✅ | ❌ | Baja |

### 4.3 Multimedia y UX

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| ★ Galería media por chat | ✅ | ✅ | ❌ | **Crítica** |
| Video messages | ✅ (beta 2026) | ✅ | ❌ | Baja |

### 4.4 Organización y Gestión

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| ★ Fijar conversación al top | ✅ | ✅ | ❌ | Alta |
| ★ Archivar conversación | ✅ | ✅ | ❌ (hide sí existe) | Alta |
| ★ Exportar chat (.txt/.json) | ✅ | ✅ | ❌ | Media |
| ★ Modo ahorro de datos | ✅ (no auto-download) | ✅ | ❌ | Media |

### 4.5 Grupo y Administración

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| ★ Admin: cambiar nombre/foto | ✅ | ✅ | ⚠️ Parcial (editar room) | Alta |
| ★ Invitar por link | ✅ | ✅ | ❌ | Alta |
| ★ Eventos en grupo | ✅ (2026) | ✅ | ❌ | Media |
| ★ Voz en grupo (Discord-like) | ✅ | ❌ | ❌ | Media |
| Aprobación de nuevos miembros | ✅ | ✅ | ❌ | Media |
| Cambiar admin / roles | ✅ | ✅ | ⚠️ Parcial | Alta |

### 4.6 Seguridad y Privacidad

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| ★ Cifrado end-to-end | ✅ (default) | ⚠️ (Secret) | ❌ | **Crítica** (depende del contexto) |
| ★ Verificación de seguridad | ✅ | ❌ | ❌ | Media |
| Mensajes que desaparecen | ✅ | ✅ (Secret) | ❌ | Media |

### 4.7 Extras Modernos

| Feature | WhatsApp | Telegram | Nexus | Prioridad |
|---------|----------|----------|-------|-----------|
| Efectos de mensajes (md-like) | ✅ | ✅ | ❌ | Baja |
| Link preview (URL unfurling) | ✅ | ✅ | ❌ | Alta |
| Búsqueda global de mensajes | ✅ | ✅ | ❌ | **Crítica** |
| Búsqueda inline en chat | ✅ | ✅ | ❌ | **Crítica** |

---

## 6. Plan de Features Prioritarios

| # | Feature | Esfuerzo | Impacto UX | Dependencia | Estado |
|---|---------|----------|------------|-------------|--------|
| 7 | ★ Galería media por chat | 1 semana | 🔥 Alto | — | ❌ |
| 8 | Fijar conversaciones al top | 2 días | Alto | — | ❌ |
| 16 | Mensajes temporales | 3 días | Medio | #1 | ❌ |
| 20 | Exportar chat | 3 días | Bajo | — | ❌ |

---

### 7.3 Estrategia de Conexión

```
1. Client conecta → HTTP GET /api/ws-token → obtiene JWT efímero (60s)
2. Client conecta → ws://host/ws?token=<jwt>
3. Server verifica JWT, registra en ConnectionManager + Redis
4. Server envía presence: { type: "presence", user_id, status: "online" }
5. Client envía mensaje → WS { type: "send_message", ... }
6. Server: persiste en DB + publica en Redis Pub/Sub
7. Workers (otros servidores WS): reciben de Redis, entregan al destinatario
```

### 7.4 Reconnection Strategy

```
1. WS disconnect → backoff exponencial: 1s, 2s, 4s, 8s, 16s (max 30s)
2. JWT expira → renew via /api/ws-token
3. Al reconectar: obtener last_message_id de cada conversación
4. Request catch-up: GET /messages/since/{last_id}
```

### 7.5 Optimización de Payload WebSocket

```typescript
// Formato compacto (vs. Message completo)
interface WsMessage {
  t: "msg" | "typing" | "read" | "presence" | "reaction" | "delete" | "edit";
  c: string;        // conversation_id (room_id o user_id)
  m?: Partial<Message>;  // payload mínimo
  u?: string;       // user_id
  ts: number;       // timestamp epoch ms
}
```

**Ahorro estimado:** ~60-70% vs. JSON con nombres completos.

---

## 9. Conclusión

**TL;DR:** El sistema implementado ya alcanza el target arquitectónico definido en la sección 7.

**Logros Sprints 1-7:**
1. **Tiempo real** — WebSocket con JWT, heartbeat, backoff exponencial, catch-up on reconnect.
2. **DB optimizada** — Índices compuestos, denormalized data, eager loading, Redis cache 30s TTL.
3. **Frontend optimizado** — Virtualización react-virtuoso, React.memo en todos los componentes, lazy loading + Suspense, debounced search, IndexedDB offline + outbox.
4. **Features críticas completadas** — Edit/delete messages, typing indicators, read receipts, online/offline presence.
5. **Payload eficiente** — WS minimizado, REST con expand params.

**Features de madurez pendientes:**
| Prioridad | Feature | Esfuerzo |
|-----------|---------|----------|
| ⭐⭐⭐ | Búsqueda global | 2 semanas |
| ⭐⭐⭐ | Galería media por chat | 1 semana |
| ⭐⭐ | Reenviar | 3 días |
| ⭐⭐ | Fijar/Archivar conversaciones | 2 ddiacute;a cada uno |
| ⭐⭐ | Pin/Unpin messages | 2 días |
| ⭐ | Link preview | 1 semana |

**Madurez general: 8.5/10** → feature parity con WhatsApp/Telegram excepto búsqueda y galería.
