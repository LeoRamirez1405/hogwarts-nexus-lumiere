# Plan de Refactorización y Modularización

**Fecha:** 2026-07-31  
**Proyecto:** Hogwarts Nexus Lumiére  
**Objetivo:** Reducir archivos >500 líneas a módulos <300 líneas, mejorar mantenibilidad y reutilización.

---

## Resumen de Archivos Grandes

| Archivo | Líneas | Categoría | Prioridad |
|---------|--------|-----------|-----------|
| `frontend/app/(main)/messages/ChatPanel.tsx` | **1,558** | Chat Core | 🔴 Crítica |
| `frontend/lib/api.ts` | **1,299** | API Client | 🔴 Crítica |
| `frontend/app/(main)/messages/page.tsx` | **958** | Chat Page | 🟠 Alta |
| `frontend/app/(main)/messages/MessageRenderers.tsx` | **845** | Message UI | 🟠 Alta |
| `backend/app/routers/creatures.py` | **773** | Pets Backend | 🟠 Alta |
| `frontend/app/(main)/pets/page.tsx` | **781** | Pets Page | 🟠 Alta |
| `backend/app/routers/messages/rooms.py` | **746** | Rooms Backend | 🟠 Alta |
| `frontend/app/(main)/admin/groups/page.tsx` | **766** | Admin Groups | 🟡 Media |
| `frontend/app/(main)/admin/transactions/page.tsx` | **697** | Admin Trans | 🟡 Media |
| `frontend/app/(main)/news/page.tsx` | **573** | News Page | 🟡 Media |
| `frontend/app/(main)/admin/settings/page.tsx` | **537** | Admin Settings | 🟡 Media |
| `frontend/app/(main)/profile/[id]/page.tsx` | **522** | Profile Page | 🟡 Media |

---

## Análisis Detallado por Archivo

### 1. `ChatPanel.tsx` (1,558 líneas) 🔴

**Problemas detectados:**
- Todo en un solo componente: header, lista mensajes, input, stickers, voice recording, pinned bar, members panel, search
- `useVoiceRecorder` hook de 200 líneas dentro del archivo
- Lógica de scroll/pagination compleja (150 líneas)
- Renderizado inline de UI compleja (menus, modals, attachment preview)

**Estrategia de refactor:**
```
frontend/app/(main)/messages/
├── components/
│   ├── ChatHeader.tsx           # Header con avatar, status, acciones
│   ├── ChatMessages.tsx         # Lista virtualizada (Virtuoso wrapper)
│   ├── ChatInput.tsx            # Input bar + attachment + voice
│   ├── ChatVoiceRecorder.tsx    # Voice recording UI (extraído)
│   ├── PinnedMessagesBar.tsx    # Pinned messages collapsible
│   ├── MembersPanel.tsx         # Panel lateral de miembros
│   ├── InChatSearch.tsx         # Búsqueda dentro del chat
│   └── ChatMenu.tsx             # Menú contextual (more_vert)
├── hooks/
│   ├── useVoiceRecorder.ts      # Hook completo de voz (200+ líneas)
│   ├── useChatScroll.ts         # Lógica scroll/pagination
│   ├── useChatSearch.ts         # In-chat + mention search
│   └── useMessageActions.ts     # Pin, star, edit, delete, forward
├── ChatPanel.tsx                # Orquestador (~200 líneas)
└── types.ts                     # Interfaces compartidas
```

---

### 2. `api.ts` (1,299 líneas) 🔴

**Problemas detectados:**
- Monolito con 80+ endpoints
- 60+ interfaces de tipos al final
- Mezcla: auth, users, products, articles, messages, pets, transactions, admin

**Estrategia de refactor:**
```
frontend/lib/api/
├── core/
│   ├── client.ts                # request(), uploadFile(), auth refresh
│   ├── types.ts                 # PaginationParams, Page<T>, buildQuery
│   └── errors.ts                # ApiError class
├── auth.ts                      # login, register, getMe, refresh, logout
├── users.ts                     # users CRUD, house points, search
├── products.ts                  # products, purchases, batch
├── articles.ts                  # articles, subscriptions, full-state
├── messages.ts                  # conversations, rooms, DMs, pins, reactions
├── creatures.ts                 # creatures, adoptions, market, sanctuary
├── petItems.ts                  # pet items, inventory, buy
├── transactions.ts              # deposit, withdraw, transfer, admin
├── admin/
│   ├── settings.ts              # enum types, feature flags
│   ├── auditLogs.ts
│   └── dashboard.ts
├── notifications.ts
├── forum.ts
├── posts.ts
├── support.ts
├── upload.ts
└── index.ts                     # Re-export: export const api = { ... }
```

**Nota:** Mantener `api` como objeto único para compatibilidad:
```ts
// index.ts
export const api = {
  ...authApi,
  ...usersApi,
  ...productsApi,
  // ...
};
```

---

### 3. `page.tsx` (Messages) (958 líneas) 🟠

**Problemas detectados:**
- WebSocket handlers (8 handlers, 120 líneas)
- IndexedDB/outbox logic
- Conversation selection + deep linking
- 15+ callbacks pasados a ChatPanel
- ConversationItem rendering inline

**Estrategia de refactor:**
```
frontend/app/(main)/messages/
├── hooks/
│   ├── useConversations.ts      # fetch + cache + search
│   ├── useWebSocket.ts          # WS connection + 8 handlers
│   ├── useMessagePagination.ts  # loadOlder, refreshCurrent
│   ├── useIndexedDBMessages.ts  # Ya existe, extender
│   └── useOutbox.ts             # Ya existe
├── components/
│   ├── ConversationList.tsx     # Sidebar con search + skeleton
│   ├── ConversationItem.tsx     # Ya existe
│   ├── NewChatModal.tsx         # Ya existe (dynamic import)
│   ├── ThirdPane.tsx            # Ya existe (dynamic import)
│   └── GlobalSearchPanel.tsx    # Búsqueda global
├── utils/
│   ├── conversationHelpers.ts   # selectConversation, buildSelectedConv
│   └── notificationSync.ts      # markNotifsReadMatching logic
├── MessagesPage.tsx             # Orquestador (~150 líneas)
└── types.ts
```

---

### 4. `MessageRenderers.tsx` (845 líneas) 🟠

**Problemas detectados:**
- 10 componentes memoizados en un archivo
- PollView, StickerView, VoiceView, DocumentView, PostShareView, ReplyPreview, ReactionBar, ReactionPicker, MentionText, MessageBubble
- Cada uno podría ser su propio archivo

**Estrategia de refactor:**
```
frontend/app/(main)/messages/components/
├── MessageBubble.tsx            # Componente principal
├── renderers/
│   ├── PollView.tsx
│   ├── StickerView.tsx
│   ├── VoiceView.tsx
│   ├── DocumentView.tsx
│   ├── PostShareView.tsx
│   ├── ImageView.tsx
│   ├── VideoView.tsx
│   └── AudioView.tsx
├── ReplyPreview.tsx
├── ReactionBar.tsx
├── ReactionPicker.tsx
├── MentionText.tsx
├── MessageActions.tsx           # Botones hover: reply, pin, star, forward, edit, delete
└── index.ts                     # Re-export todo
```

---

### 5. `creatures.py` (773 líneas) 🟠

**Problemas detectados:**
- 15 endpoints en un router
- Lógica de aging/decay duplicada en 3 endpoints (`/my`, `/my-full-state`, `/market`)
- Helper functions privadas al inicio (_sanctuary_level_for, _check_requirements, _process_aging, _settle_decay, _consume_item, _owned_creature)

**Estrategia de refactor:**
```
backend/app/
├── services/
│   ├── pet_service.py           # aging, decay, level-up, sanctuary score
│   ├── creature_service.py      # adopt, feed, play, market buy/sell
│   └── notification_templates.py # pet_farewell, pet_escaped, pet_sold
├── routers/
│   ├── creatures/
│   │   ├── __init__.py
│   │   ├── catalog.py           # GET /, GET /{id}, POST, PUT, DELETE (admin)
│   │   ├── my_creatures.py      # GET /my, GET /my-full-state
│   │   ├── market.py            # GET /market, POST /market/{id}/buy
│   │   ├── interactions.py      # POST /{id}/feed, /play, /sell, /adopt
│   │   └── stats.py             # GET /stats
│   └── __init__.py              # router.include_router(...)
└── models/                      # Sin cambios
```

**Extraer lógica compartida:**
```python
# services/pet_service.py
async def apply_aging_and_decay(db, user_creature) -> bool:  # returns True if removed
    retired = await _process_aging(db, user_creature)
    if retired: return True
    escaped = _settle_decay(user_creature)
    if escaped:
        await _handle_escape(db, user_creature)
        return True
    return False
```

---

### 6. `pets/page.tsx` (781 líneas) 🟠

**Problemas detectados:**
- 4 tabs principales (mine, adopt, market, shop) con lógica compleja cada uno
- 25+ useState
- Modal adopt + modal buy market inline
- Lógica de celebración level-up mezclada con UI

**Estrategia de refactor:**
```
frontend/app/(main)/pets/
├── components/
│   ├── PetsHeader.tsx           # Hero con stats (sanctuary, user level, zerines)
│   ├── tabs/
│   │   ├── MyPetsTab.tsx        # Grid de PetCard + load more
│   │   ├── AdoptTab.tsx         # Grid de CreatureCard
│   │   ├── MarketTab.tsx        # Grid de MarketCreatureCard
│   │   └── ShopTab.tsx          # ShopSection (food/toys) + filtros
│   ├── modals/
│   │   ├── AdoptModal.tsx       # Nombre personalizado
│   │   └── BuyMarketModal.tsx   # Confirmación compra
│   └── PetCard.tsx              # Ya existe en components/domain/Pets
├── hooks/
│   ├── usePetsData.ts           # getMyFullState + refresh logic
│   ├── usePetActions.ts         # adopt, buy, use, list, unlist, buyMarket
│   ├── usePetCelebrations.ts    # LevelUpCelebration queue
│   └── useShopFilter.ts         # petType filter
├── PetsPage.tsx                 # Orquestador (~100 líneas)
└── types.ts
```

---

### 7. `rooms.py` (746 líneas) 🟠

**Problemas detectados:**
- 14 endpoints en un router
- Lógica de serialización mezclada con endpoints
- Auditoría repetitiva en cada mutación

**Estrategia de refactor:**
```
backend/app/routers/messages/
├── rooms/
│   ├── __init__.py
│   ├── crud.py                  # create, get, update, delete, list
│   ├── members.py               # add, batch_add, remove, leave
│   ├── messages.py              # get_messages, send_message
│   ├── settings.py              # toggle_close, mute, archive
│   └── serializers.py           # serialize_room, serialize_room_brief
├── core.py                      # send_message (ya existe)
├── deps.py                      # _initial_limit, _older_than, _resolve_cursor (ya existe)
├── serializers.py               # serialize_message (ya existe)
└── __init__.py                  # router.include_router(rooms.router)
```

---

### 8. `admin/groups/page.tsx` (766 líneas) 🟡

**Problemas detectados:**
- Usa `useAdminCrud` hook (bueno)
- 3 modales grandes inline (Create, Edit, Members)
- Tabla + cards duplicados (mobile/desktop)
- Lógica de avatar upload duplicada

**Estrategia de refactor:**
```
frontend/app/(main)/admin/groups/
├── components/
│   ├── GroupsTable.tsx          # Desktop table
│   ├── GroupsCards.tsx          # Mobile cards
│   ├── CreateGroupModal.tsx     # Form + member picker
│   ├── EditGroupModal.tsx       # Form + avatar
│   └── ManageMembersModal.tsx   # Search + selected + current members
├── hooks/
│   └── useGroupActions.ts       # toggleClose, delete, addMembers
├── AdminGroupsPage.tsx          # Orquestador (~150 líneas)
└── types.ts
```

---

### 9. `admin/transactions/page.tsx` (697 líneas) 🟡

**Problemas detectados:**
- 2 tabs (user/admin) con lógica duplicada
- Filtros complejos (type, date range, user search)
- Stats semanales computados en render
- Tabla + cards duplicados

**Estrategia de refactor:**
```
frontend/app/(main)/admin/transactions/
├── components/
│   ├── TransactionStats.tsx     # 3 cards: deposits, withdrawals, transfers
│   ├── TransactionFilters.tsx   # Type chips + date range + user search
│   ├── TransactionsTable.tsx    # Desktop
│   ├── TransactionCards.tsx     # Mobile
│   └── TransactionRow.tsx       # Shared row component
├── hooks/
│   ├── useTransactions.ts       # userTransactions + adminTransactions
│   ├── useTransactionFilters.ts # filter state + buildFilters
│   └── useTransactionStats.ts   # weekly stats memo
├── AdminTransactionsPage.tsx    # Orquestador (~100 líneas)
└── types.ts
```

---

### 10. `news/page.tsx` (573 líneas) 🟡

*Revisar al leer el archivo completo, pero probable estructura:*
```
frontend/app/(main)/news/
├── components/
│   ├── NewsHeader.tsx
│   ├── FeaturedArticle.tsx
│   ├── ArticlesGrid.tsx
│   ├── AnnouncementsSidebar.tsx
│   ├── ClassifiedsSidebar.tsx
│   └── ArticleCard.tsx
├── hooks/
│   ├── useNewsFullState.ts
│   └── useArticleActions.ts
└── NewsPage.tsx
```

---

### 11. `admin/settings/page.tsx` (537 líneas) 🟡

**Estrategia:**
```
frontend/app/(main)/admin/settings/
├── components/
│   ├── EnumCategoriesTab.tsx
│   ├── EnumValuesTab.tsx
│   ├── FeatureFlagsTab.tsx
│   └── AdminSettingsTabs.tsx
├── hooks/
│   └── useAdminSettings.ts
└── AdminSettingsPage.tsx
```

---

### 12. `profile/[id]/page.tsx` (522 líneas) 🟡

**Estrategia:**
```
frontend/app/(main)/profile/[id]/
├── components/
│   ├── ProfileHeader.tsx
│   ├── ProfileTabs.tsx
│   ├── PostsFeed.tsx
│   ├── FriendsGrid.tsx
│   ├── AboutSection.tsx
│   └── StatsCards.tsx
├── hooks/
│   └── useProfileData.ts
└── page.tsx
```

---

## Archivos Compartidos a Crear

### UI Components (ya existen en `components/ui/`, verificar y usar)
- `Button`, `GlassCard`, `Avatar`, `Badge`, `Modal`, `SearchBar`
- `MaterialIcon` → mover a `components/ui/MaterialIcon.tsx` (ya existe)
- `AdminCrudModal`, `AdminCrudTable` → ya existen
- `ConfirmDialog`, `ToastViewport`, `Tooltip`, `DropdownMenu`

### Hooks Comunes (algunos ya existen)
- `useDebounce` ✓
- `usePaginatedList` ✓
- `useAdminCrud` ✓
- `useIndexedDB` ✓
- `useOutbox` ✓
- `useFeatureFlag` ✓

### Utilidades
- `frontend/lib/media.ts` ✓ (mediaSrc)
- `frontend/lib/toastStore.ts` ✓
- `frontend/lib/authStore.ts` ✓
- `frontend/lib/notificationStore.ts` ✓
- `frontend/lib/featureFlagStore.ts` ✓

---

## Plan de Ejecución por Fases

### Fase 1: Crítica (Semana 1-2)
1. **`api.ts`** → Split por dominio (backend-first: tipos ya en schemas)
2. **`ChatPanel.tsx`** → Extraer hooks + components
3. **`MessageRenderers.tsx`** → Split por renderer

### Fase 2: Alta (Semana 3-4)
4. **`page.tsx` (messages)** → Hooks WS + components
5. **`creatures.py`** → Services + router split
6. **`pets/page.tsx`** → Tabs + modals + hooks

### Fase 3: Media (Semana 5-6)
7. **`rooms.py`** → Router split
8. **`admin/groups/page.tsx`** → Modals + table/cards
9. **`admin/transactions/page.tsx`** → Filters + stats + table/cards

### Fase 4: Media-Baja (Semana 7)
10. **`news/page.tsx`**
11. **`admin/settings/page.tsx`**
12. **`profile/[id]/page.tsx`**

---

## Validación Post-Refactor

Para cada archivo refactorizado:
```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd backend && python -m pytest tests/ -xvs  # si existen tests
```

**Criterios de éxito:**
- ✅ Ningún archivo >300 líneas (excepto entry points)
- ✅ Lint y typecheck pasan
- ✅ Funcionalidad idéntica (manual testing)
- ✅ Componentes reutilizables exportados en `index.ts`
- ✅ Hooks probados independientemente

---

## Notas de Implementación

### Convenciones de Nomenclatura
- Hooks: `use<Feature>.ts` (ej: `useChatScroll.ts`)
- Components: `<Feature><Variant>.tsx` (ej: `ChatHeader.tsx`, `MessageBubble.tsx`)
- Services (backend): `<domain>_service.py` (ej: `pet_service.py`)
- Routers split: `<domain>/<subdomain>.py` con `router = APIRouter()`

### Imports
- Usar `@/` alias configurado en tsconfig
- Barrel exports (`index.ts`) para carpetas de components/hooks
- Tipos compartidos en `types.ts` por feature

### Testing
- Cada hook nuevo → test unitario básico
- Cada component complejo → storybook o test visual
- Backend services → pytest con mock de DB

---

## Riesgos y Mitigación

| Riesgo | Mitigación |
|--------|------------|
| Romper WebSocket en messages | Test manual exhaustivo tras Fase 1 |
| Tipos TypeScript inconsistentes | Mantener `api.ts` como barrel export |
| Duplicar lógica en hooks | Extraer a `utils/` compartidos |
| Regresiones en pets/backend | Ejecutar seed + test manual adopt/feed/play |

---

## Próximos Pasos Inmediatos

1. Crear estructura de carpetas para `messages/components`, `messages/hooks`, `api/`
2. Empezar con `api.ts` (base para todo lo demás)
3. Extraer `useVoiceRecorder` de `ChatPanel.tsx` como primer hook independiente
4. Validar lint/typecheck tras cada extracción

---

*Documento generado automáticamente. Actualizar conforme avance el refactor.*