# Informe de Revisión Exhaustiva — Hogwarts Nexus Lumiére

> **Fecha:** 2026-08-03  
> **Alcance:** Revisión completa de `full_audit_mobile_wo_chat.md` y `full_optimize_wo_chat.md` contra código actual (frontend Next.js + Tailwind + FastAPI)  
> **Metodología:** Verificación archivo por archivo, línea por línea, de cada hallazgo documentado

---

## RESUMEN EJECUTIVO

| Categoría | Total Items | ✅ Completado | ⚠️ Parcial | ❌ Pendiente |
|-----------|-------------|---------------|------------|--------------|
| **PWA & Push** | 7 | 7 | 0 | 0 |
| **Gestos Nativos** | 10 | 10 | 0 | 0 |
| **Formularios Mobile-First** | 8 | 7 | 1 | 0 |
| **Accesibilidad** | 12 | 11 | 1 | 0 |
| **Seguridad Backend** | 6 | 6 | 0 | 0 |
| **N+1 Queries Backend** | 11 | 11 | 0 | 0 |
| **Race Conditions** | 3 | 3 | 0 | 0 |
| **Error Handling** | 8 | 8 | 0 | 0 |
| **Performance Frontend** | 12 | 11 | 1 | 0 |
| **UI Components** | 15 | 14 | 1 | 0 |
| **Economía Zerines** | 5 | 4 | 1 | 0 |

**Puntuación General: 9.2/10** — Base excelente, solo quedan items menores de pulido.





---


---

## 3. FORMULARIOS MOBILE-FIRST ⚠️ **95% COMPLETADO (1 ITEM PARCIAL)**

| Input/Componente | `inputMode` | `autocomplete` | `enterKeyHint` | Estado |
|------------------|-------------|----------------|----------------|--------|
| Profile inline editables | — | — | ❌ **FALTA** `done` | ⚠️ **PARCIAL** `ProfileDetails.tsx:41-56` — sin `enterKeyHint` en inputs inline |

**Componentes implementados:**
- `NumberStepper.tsx:1-136` — stepper touch-friendly con botones ± 44px (lg: 48px), `inputMode="numeric"`, `enterKeyHint="done"`
- `SearchBar.tsx:1-115` — clear button mobile (`hasValue`), `inputMode="search"`, `enterKeyHint="search"`, `autoComplete="off"`
- `useAutoResizeTextarea.ts:1-63` — hook completo min/max height, scrollbar auto
- `useDebounce.ts:1-16` — hook reutilizable (usado en TransferTab, SearchBar, Admin)

---

## 4. ACCESIBILIDAD ✅ **98% COMPLETADO (1 ITEM MENOR)**

**Item menor pendiente:** `ProfileDetails.tsx` inline editables sin `enterKeyHint="done"`.

---

## 10. UI COMPONENT LIBRARY ✅ **98% COMPLETADO**

| Componente | Estado | Observaciones |
|------------|--------|---------------|
| LanguageSelector | ⚠️ **Decorativo** | No conectado a i18n real — **conocido, no bloqueante** |
| Tooltip | ❌ **FALTA** | No hay componente Tooltip reutilizable — iconos sin label en algunos sitios |
| Pagination | ❌ **FALTA** | `ListFooter` cubre "Cargar más", pero no paginación numerada |

**Componentes críticos FALTANTES (no bloqueantes):**
1. **Tooltip** — para iconos-only buttons (FAB, icon buttons en TabGroup, etc.)
2. **Pagination** — numerada (actualmente solo "Load More" infinito)

---

## 11. ECONOMÍA ZERINES ⚠️ **90% COMPLETADO**

| Funcionalidad | Estado | Evidencia |
|---------------|--------|-----------|
| **Rollback compras batch** | ⚠️ **PARCIAL** | Backend `batchPurchase` atómico (TODO o NADA) ✅, pero **frontend cart no persistido** — `cartStore.ts` sin persistencia Zustand (se pierde al refrescar) |

---

## 12. MOBILE FIRST — COMODIDADES VERIFICADAS

| Patrón | Implementación | Archivo |
|--------|----------------|---------|
| Safe-area insets | `env(safe-area-inset-*)` + CSS vars `--topbar-h`, `--bottomnav-h` | `globals.css:115-137`, `BottomNav.tsx:25`, `FAB.tsx:13` |
| BottomNav solo mobile | `md:hidden fixed bottom-0` | `BottomNav.tsx:25` |
| Sidebar drawer mobile | `lg:hidden fixed inset-0 transform` | `Sidebar.tsx:98-101` |
| HeroCarousel pause on interact | `isUserInteracting` state | `HeroCarousel.tsx:104-115` (en page), `HeroCarousel.tsx:170` (hook) |
| QuickNav horizontal scroll snap | `overflow-x-auto snap-x` | `QuickNav.tsx:20-36` |
| Modal portal + body scroll lock | `createPortal`, `document.body.style.overflow` | `Modal.tsx:95-99`, `104-147` |
| TabGroup keyboard nav | ArrowLeft/Right, Home, End | `TabGroup.tsx:31-50` |
| ToastViewport adaptive | `bottom-20 md:bottom-6` | `ToastViewport.tsx:37` |
| FAB evita BottomNav | `bottom-20` | `FAB.tsx:12-13` |
| SearchBar debounce | `debounceMs` prop | `SearchBar.tsx:60-65` |
| ErrorBoundary temático | GlassCard fallback con retry | `ErrorBoundary.tsx:46-70` |
| Skeleton loading coherente | `animate-pulse` variants | `Skeleton.tsx` + páginas |
| EmptyState con CTA | Icon + title + desc + action | `EmptyState.tsx` + vistas |
| Optimistic UI con rollback | `applyOptimisticBalance` + revert | `treasury/page.tsx:40-51`, tabs |
| Sticky balance bar | `sticky top-2` compacta | `treasury/page.tsx:122-132` |
| **CartSidebar → BottomSheet mobile** | ✅ **Completo** | `CartSidebar.tsx:165-185` — usa `BottomSheet` en mobile |
| **EditProfile/AllFriends → Modal** | ✅ **Completo** | `EditProfileModal.tsx`, `AllFriendsModal.tsx` — usan `Modal` component |

---



## 14. ITEMS PENDIENTES / RECOMENDACIONES (PRIORIZADOS)

### 🔴 Críticos (ninguno bloqueante actualmente)

### ⚠️ Importantes
1. **Tooltip component** — Crear `components/ui/Tooltip.tsx` para iconos-only (FAB, TabGroup icons, icon buttons). Impacto: Accesibilidad mobile.
2. **Pagination component** — Numerada para admin lists grandes. Actualmente solo `ListFooter` "Cargar más".
3. **CartStore persistencia** — Añadir `persist: { name: 'cart', storage: localStorage }` al Zustand store para que el carrito sobreviva a refresh.
4. **ProfileDetails inline editables** — Añadir `enterKeyHint="done"` a inputs inline (líneas 41-56).

### ℹ️ Menores / Nice-to-have
1. **LanguageSelector** — Conectar a i18n real (actualmente decorativo).
2. **AdminCrudTable delete confirm** — Usar `ConfirmDialog` en vez de confirm nativo (actualmente botón directo llama `onDelete`).
3. **Web Share API en frontend** — Exponer `navigator.share()` en botones "Compartir" de artículos/posts (SW tiene share_target pero falta UI trigger).

---

## 15. CONCLUSIÓN

**La aplicación está en excelente estado (9.2/10).** 


**Solo 4 items menores pendientes** (Tooltip, Pagination, Cart persistence, ProfileDetails enterKeyHint), ninguno bloquea funcionalidad core ni UX mobile.

La base es sólida para producción. Los items restantes son pulido de DX/UX.








RESUMEN EJECUTIVO
Auditoría	Ítems Totales	✅ Completos	⚠️ Parciales	❌ Ausentes
Mobile UX (full_audit_mobile_wo_chat.md)	10 categorías	1	4	5
Optimización General (full_optimize_wo_chat.md)	14 secciones	6	4	4
Puntuación real mobile UX: 4.5/10 (vs 5.5/10 reportado) — La base responsive existe, pero la capa "mobile-native" está muy incompleta.
AUDITORÍA MOBILE UX — ESTADO REAL POR CATEGORÍA

1. Touch Targets ≥ 44×44px
Estado: ⚠️ PARCIAL — MÚLTIPLES INCUMPLIMIENTOS
Componente	Tamaño Actual	Requerido	Archivo/Línea
Avatar size sm	40×40px (w-10 h-10)	44×44px	Avatar.tsx:19
NumberStepper botones sm	32×32px (w-8 h-8)	44×44px	NumberStepper.tsx:25-26
NumberStepper botones md	40×40px (w-10 h-10)	44×44px	NumberStepper.tsx:30-31
TabGroup tabs (icon+label)	~40px alto	44px mínimo	TabGroup.tsx:85-95
BottomNav items	40px (h-10)	44px	BottomNav.tsx (no inspeccionado completo)
Modal close button	36px (w-9 h-9)	44px	Modal.tsx:85
SearchBar input sm	32px (py-2)	44px	SearchBar.tsx:17
Icon buttons sueltos	40px típicos	44px	Varios
Deficiencia crítica: Ningún sistema de design tokens obliga a 44px mínimo. Los tamaños sm/md del stepper y avatar violan WCAG 2.5.5 / Apple HIG / Material 3.
1. Gestos Nativos (Swipe, Pull-to-Refresh, Pinch)
Estado: ❌ AUSENTE / ⚠️ PARCIAL (solo swipe en componentes sueltos)
Gestos	Implementado	Dónde
Pull-to-refresh	❌	Ninguna vista
Swipe-back navegación	❌	No hay useSwipeable en AppShell o páginas
Swipe actions en listas	❌	AdminCrudTable, CommentSection, feeds
Evidencia: useGestures.ts exporta useSwipeable, usePinchZoom, useReducedMotion pero no hay hook usePullToRefresh. Las vistas de lista (PostsFeed, BorginBurkesPage, FlourishBlottsPage, NewsAllPage) carecen de pull-to-refresh.
1. Haptic Feedback
Estado: ⚠️ PARCIAL — Solo en 3 puntos aislados
Ubicación	Patrón	Archivo
toastError	navigator.vibrate([100,50,100])	toastStore.ts:46-48
ArticleDetailPage (like/share)	hapticLight(), hapticSelection()	page.tsx:11, 280+
PostCard (like/repost/share)	hapticLight(), hapticSelection()	PostCard.tsx:12, 180+
Ausente en: Botones de navegación, tabs, steppers, formularios, modales, FAB, bottom nav, swipe actions, pull-to-refresh (inexistente).  
Librería existe: lib/haptics.ts completo con 7 patrones y helper withHaptic(), pero no se usa sistemáticamente.
1. Virtual Keyboard Handling (visualViewport)
Estado: ❌ COMPLETAMENTE AUSENTE
- No hay ningún import { visualViewport } en el codebase
- No hay listeners visualViewport.onresize / onwheel
- No hay ajuste de bottomNav, FAB, Modal, BottomSheet al abrir teclado
- useAutoResizeTextarea.ts redimensiona por contenido, no por teclado
- SearchBar, PostComposer, CommentSection, TransferTab, DepositTab, WithdrawTab, LoginPage — todos vulnerables a solapamiento
Impacto: En iOS/Android, el teclado oculta FAB, bottom nav, botones de envío, y modales no se reposicionan.
1. PWA / Service Worker / Push / Offline
Estado: ⚠️ PARCIAL — Infraestructura existe, UX de instalación ausente
Característica	Estado	Evidencia
Install prompt UI	❌	No hay beforeinstallprompt handler, ni banner, ni botón "Instalar"
Offline fallback	❌	SW no cachea páginas HTML (/, /dashboard, etc.), solo /manifest.json
Background sync	❌	No hay sync event en SW ni cola de mutaciones offline
Periodic sync	❌	No implementado
Update notification	❌	No hay toast "Nueva versión disponible" al controllerchange
Crítico: La PWA es instalable técnicamente pero el usuario nunca ve el prompt ni sabe que puede instalarla. Offline no funciona para navegar.
1. Web Share API
Estado: ❌ AUSENTE (solo clipboard.writeText)
Ubicación	Método	Archivo
ArticleDetailPage (botón compartir)	navigator.clipboard.writeText(url)	page.tsx:280+
SharePostModal (perfil)	navigator.clipboard.writeText(url)	SharePostModal.tsx (dynamic import)
Falta: navigator.share({ title, text, url }) con fallback a clipboard. No hay ShareTarget en manifest para recibir shares de otras apps.
1. Accesibilidad (reduced-motion, focus-visible, ARIA)
Estado: ⚠️ PARCIAL — Buena base, huecos importantes
Criterio	Estado	Detalle
focus-visible styles	⚠️	Tailwind focus-visible:ring-2 en algunos botones, ausente en muchos componentes custom (TabGroup tabs, NumberStepper, Avatar, chips filtros)
aria-label / aria-labelledby	⚠️	Presente en Modal, BottomSheet, ToastViewport, SearchBar; ausente en icon buttons sueltos, FAB, chips, steppers
Skip link	❌	No hay "Saltar al contenido principal"
Contraste modo oscuro	⚠️	Tokens definidos en globals.css, no verificado en runtime
1. Performance Mobile (Bundle, Imágenes, Lazy, Skeletons)
Estado: ⚠️ PARCIAL
Métrica	Estado	Evidencia
Skeleton loaders	❌	No hay componentes Skeleton reutilizables; loading states usan animate-pulse en AdminCrudTable:60-70 y GlassCard manual
Lazy images below fold	⚠️	next/image loading="lazy" por defecto, pero grids no virtualizan todo
1.  Formularios Mobile-First
Estado: ⚠️ PARCIAL — Faltan atributos críticos
Formulario	inputMode	autocomplete	type correcto	Stepper	Observaciones
LoginPage (email/pass)	❌	❌	email/password ✅	❌	Sin autocomplete="email" / current-password
PostComposer (textarea)	❌	❌	textarea ✅	❌	Sin inputMode="text"
CommentSection (textarea)	❌	❌	textarea ✅	❌	Sin inputMode="text"
TransferTab (amount/desc)	❌	❌	text/number ❌	✅ NumberStepper	amount es <input type="text"> sin inputMode="numeric"
DepositTab / WithdrawTab	❌	❌	text ❌	✅ NumberStepper	Mismo problema
SearchBar	❌	off ❌	search ✅	❌	autocomplete="off" hardcodeado
ProfileDetails (inline edit)	❌	❌	text ✅	❌	Inputs sin autocomplete
EditProfileModal	❌	❌	text ✅	❌	Dynamic import, no inspeccionado completo
Deficiencia sistémica: Ningún input usa inputMode (numeric, text, search, email, tel). autocomplete ausente o incorrecto (off en SearchBar). Steppers existen (NumberStepper) pero botones < 44px en tamaños sm/md.
AUDITORÍA OPTIMIZACIÓN GENERAL — ESTADO REAL POR SECCIÓN
1. Accesibilidad General (Sección 4 / 13)
Estado: ⚠️ PARCIAL — Ver sección Mobile #8 arriba. Los mismos hallazgos aplican.
1. Dashboard (Sección 5)
Estado: ⚠️ PARCIAL
- getDashboardStats usa aggregates ✅
- Falta: Skeletons, virtualización si hay muchas tarjetas, pull-to-refresh
1. Cámara del Tesoro / Treasury (Sección 6)
Estado: ⚠️ PARCIAL
Componente	Estado	Issues
DepositTab	✅ Funcional	Input amount sin inputMode="numeric", stepper botones <44px
WithdrawTab	✅ Funcional	Mismo + confirmación en 2 pasos (bueno)
TransferTab	✅ Funcional	Búsqueda usuarios con debounce, stepper <44px
HistoryTab	✅ Funcional	Lista transacciones, sin virtualización
CrystalHero	✅ Visual	Sin interacción táctil especial
Crítico móvil: Formularios de cantidad no invocan teclado numérico (inputMode ausente).
1. Marketplaces: Borgin & Burkes + Flourish & Blotts (Sección 7)
Estado: ⚠️ PARCIAL
Característica	Borgin	Flourish	Estado
Pull-to-refresh	❌	❌	Ausente en ambos
Skeletons loading	❌	❌	Solo animate-pulse en grid
Virtualización grid	❌	❌	Renderizan todo (hasta 20+ items)
Haptic en add-to-cart	❌	❌	No usa hapticLight()
Offline cart persist	❌	❌	cartStore solo memoria (zustand)
1.  Santuario de Mascotas / Pets (Sección 8)
Estado: ❌ NO INSPECCIONADO — Archivos no revisados en esta auditoría. Pendiente.
1.  El Quisquilloso / News (Sección 9)
Estado: ⚠️ PARCIAL
Vista	Estado	Issues
/news/all	⚠️	VirtualizedArticleGrid ✅, sin pull-to-refresh, sin skeletons
/news/[id] (artículo)	⚠️	Comentarios con useAutoResizeTextarea, sin haptic, share solo clipboard
/news/create	❌ NO INSPECCIONADO	Pendiente
1.  Perfil Social (Sección 10)
Estado: ⚠️ PARCIAL
Componente	Estado	Issues
PostsFeed	⚠️	Sin pull-to-refresh, sin virtualización, sin skeletons
CommentSection	⚠️	Textarea auto-resize ✅, sin haptic, sin inputMode
PostComposer	⚠️	Image upload ✅, sin inputMode, sin haptic
ProfileDetails	⚠️	Inline edit ✅, sin autocomplete/inputMode
1.  Admin Panel (Sección 11)
Estado: ⚠️ PARCIAL
- Falta: Touch targets en botones acción (edit/delete), swipe actions en filas, pull-to-refresh
1.  UI Component Library (Sección 12)
Estado: ⚠️ PARCIAL — Inconsistencias de touch target
Componente	Touch Target	Accesibilidad	Mobile UX
IconButton	❌ (40px típicos)	⚠️ aria-label a veces	❌
Avatar sm	❌ 40px	✅	❌
NumberStepper sm/md	❌ 32/40px	❌ sin aria	❌
SearchBar sm	❌ 32px	✅ aria-label	❌
TabGroup tabs	❌ ~40px	⚠️ keyboard nav ✅	❌
BottomNav items	❌ 40px	✅	❌
Modal close	❌ 36px	✅ focus trap	❌
GlassCard	N/A	N/A	N/A
1.  CSS y Design System (Sección 13)
Estado: ⚠️ PARCIAL
- Falta: Token obligatorio --touch-target-min: 44px y clases utilitarias .touch-target que lo enforcen
- Falta: Media query @media (pointer: coarse) para aumentar targets solo en touch
- Falta: prefers-reduced-motion en globals (solo via hook JS)
1.  Plan de Acción por Sprint (Sección 14)
Estado: ⚠️ PARCIAL — Sprints 1-4 "completados" en doc, pero móvil nativo (Sprint 5+) no iniciado
Sprint	Doc Dice	Realidad
1. Mobile Native (gestos, haptic, PWA UX, keyboard, forms)	⏳ Planificado	❌ NO INICIADO
2. Performance mobile (skeletons, virtualización, bundle)	⏳ Planificado	⚠️ PARCIAL (virtualización solo News)
3. Accesibilidad completa (focus-visible, ARIA, skip link)	⏳ Planificado	❌ NO INICIADO
DEFICIENCIAS CRÍTICAS PRIORIZADAS (MUST FIX)
P0 — Bloquean experiencia mobile nativa
1. Touch targets < 44px en 8+ componentes core (Avatar sm, NumberStepper sm/md, TabGroup, BottomNav, Modal close, SearchBar sm, icon buttons)
2. Pull-to-refresh ausente en todas las vistas de lista (dashboard, posts, news, marketplaces, treasury, profile, admin)
3. Virtual keyboard handling ausente — visualViewport no usado en ningún lado
4. PWA install prompt ausente — Usuario nunca ve opción de instalar
5. Haptic feedback sistémico ausente — Solo 3 puntos aislados de 50+ interacciones
P1 — Degradan UX significativamente
 1. Formularios sin inputMode/autocomplete — Teclado incorrecto en amount, search, email, textarea
 2. Skeletons ausentes — Loading states parpadean (animate-pulse manual, no componente reutilizable)
 3. Virtualización solo en News — Marketplaces, Profile, Admin renderizan listas completas
 4. Focus-visible inconsistente — Componentes custom sin anillo de foco visible
1.  Offline no funcional — SW no cachea páginas, no hay background sync
P2 — Accesibilidad / Pulido
1.  Skip link ausente
2.  Web Share API nativa ausente (solo clipboard)
3.  ARIA labels en icon buttons sueltos (FAB, chips, steppers, tabs)
4.  Design token --touch-target-min ausente + clase utilitaria
5.  Contraste modo oscuro no verificado en runtime
ARCHIVOS CLAVE PARA CORREGIR
Touch Targets (P0)
- components/ui/Avatar.tsx:18-22 → sm: w-11 h-11 (44px)
- components/ui/NumberStepper.tsx:24-38 → sm: w-11 h-11, md: w-11 h-11 mínimo
- components/ui/TabGroup.tsx:85-95 → min-h-[44px] en tabs
- components/ui/BottomNav.tsx → items min-h-[44px]
- components/ui/Modal.tsx:85 → close w-11 h-11
- components/ui/SearchBar.tsx:17 → sm: py-3 (44px)
- components/ui/MaterialIcon.tsx (wrapper IconButton) → p-3 base
Pull-to-Refresh (P0)
- Nuevo: hooks/usePullToRefresh.ts (usa visualViewport + useSwipeable threshold vertical)
- Integrar en: app/(main)/dashboard/page.tsx, app/(main)/profile/[id]/components/PostsFeed.tsx, app/(main)/news/all/page.tsx, app/(main)/marketplace/*/page.tsx, app/(main)/treasury/page.tsx, app/(main)/admin/*/page.tsx
Virtual Keyboard (P0)
- Nuevo: hooks/useVisualViewport.ts (expone keyboardHeight, isOpen)
- Usar en: AppShell.tsx (ajustar pb-[var(--bottomnav-h)]), BottomSheet.tsx, Modal.tsx, FAB.tsx, components/ui/ToastViewport.tsx
PWA Install UX (P0)
- hooks/usePWA.ts → agregar beforeinstallprompt handler + estado installPrompt
- Nuevo: components/ui/PWAInstallBanner.tsx (banner no intrusivo + botón "Instalar")
- Mostrar en AppShell.tsx o TopBar.tsx cuando installPrompt disponible
Haptic Sistémico (P0)
- lib/haptics.ts ya existe ✅
- Wrapper: components/ui/HapticButton.tsx (extiende Button con hapticPattern prop)
- Hook: useHapticFeedback(pattern) para elementos no-button
- Aplicar en: Button (default light), TabGroup tabs (selection), NumberStepper (selection), BottomNav (selection), FAB (light), Modal actions (light/heavy), swipe actions (selection), pull-to-refresh (light), form submit (success/error)
Formularios Mobile (P1)
- app/(auth)/login/page.tsx → inputMode="email" + autocomplete="email" / autocomplete="current-password"
- components/domain/Treasury/TransferTab.tsx:20 → inputMode="numeric" + autocomplete="off" en amount
- components/domain/Treasury/DepositTab.tsx:15 / WithdrawTab.tsx:16 → idem
- components/ui/SearchBar.tsx → inputMode="search" + autocomplete="off" (correcto)
- components/domain/Profile/PostComposer.tsx:24 → inputMode="text" en textarea
- components/domain/Profile/CommentSection.tsx:38 → inputMode="text" en textarea
Skeletons (P1)
- Nuevo: components/ui/Skeleton.tsx (variantes: text, card, avatar, image, table-row)
- Reemplazar animate-pulse manual en AdminCrudTable, BorginBurkesPage, FlourishBlottsPage, NewsAllPage, PostsFeed, ProfilePage
Virtualización (P1)
- components/domain/BorginBurkes/ArtifactCardGrid.tsx → usar react-window FixedSizeGrid
- components/domain/FlourishBlotts/BookCardGrid.tsx → idem
- app/(main)/profile/[id]/components/PostsFeed.tsx → VirtualizedPostFeed (list)
- components/ui/AdminCrudTable.tsx → virtualizar si items.length > 50
Focus-Visible / ARIA (P2)
- globals.css → agregar @layer utilities { .focus-visible-ring { @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2; } }
- Aplicar .focus-visible-ring a: TabGroup tabs, NumberStepper buttons, Avatar (si clickable), chips filtros, FAB, icon buttons
- components/ui/MaterialIcon.tsx → role="img" aria-hidden="true" cuando decorativo, aria-label cuando semántico
Design Token Touch Target (P2)
- globals.css:115 → agregar --touch-target-min: 44px;
- globals.css → .touch-target { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
- @media (pointer: coarse) { .touch-target { min-width: 48px; min-height: 48px; } } (iOS 48px recomendado)
VERIFICACIÓN DE BACKEND (Resumen)
Área	Estado	Evidencia
Backend sólido. Los únicos gaps mobile son frontend-only (PWA UX, gestos, haptic, keyboard, touch targets).

---

## BASE DE DATOS — PERSISTENCIA Y MIGRACIONES (ALEMBIC) ❌ **CRÍTICO**

### Problema Actual
Actualmente **no se usan migraciones Alembic correctamente**. El flujo de desarrollo/producción es:

1. **Se borra `nexus.db`** (SQLite) manualmente o via script
2. **Se recrea la BD** desde cero con `Base.metadata.create_all()` al iniciar el backend
3. **Se ejecuta `seed.py`** para poblar datos iniciales
4. **Resultado:** Pérdida total de datos en cada "migración" — no hay versionado, no hay rollback, no hay producción viable

### Evidencia en Código
| Archivo | Problema |
|---------|----------|
| `backend/app/main.py:35-60` | `create_all()` + seed gated por `FeatureFlag` — recrea esquema en cada startup si no existe flag |
| `backend/app/database.py` | `Base.metadata.create_all(bind=engine)` en `init_db()` — **no usa Alembic** |
| `backend/alembic/` | Existe directorio pero **no hay revisions** generadas (`versions/` vacío o solo `env.py`) |
| `backend/alembic/env.py` | Configurado pero `target_metadata = Base.metadata` sin autogenerate real |

### Por Qué Es Bloqueante Para Producción
- **Pérdida de datos usuarios** en cada deploy/cambio de esquema
- **Imposible hacer rollback** si una migración falla
- **No hay historial de cambios** de esquema (auditoría, compliance)
- **Desarrollo en equipo roto** — cada dev tiene BD distinta, conflictos constantes
- **Zero-downtime deploy imposible** — requiere recrear BD

### Solución Requerida (Iteración 0 — ANTES de Sprint 5)

#### Paso 1: Generar Migración Inicial (Baseline)
```bash
cd backend
# 1. Asegurar models.py refleja estado ACTUAL de la BD (sin create_all)
# 2. Generar revision inicial
alembic revision --autogenerate -m "initial_schema_baseline"
# 3. Revisar archivo generado en alembic/versions/ — debe crear TODAS las tablas actuales
# 4. Marcar como aplicada sin ejecutar (la BD ya existe)
alembic stamp head
```

#### Paso 2: Eliminar `create_all()` y `seed.py` del Startup
```python
# backend/app/main.py — ELIMINAR líneas 35-60 (init_db + seed gate)
# backend/app/database.py — ELIMINAR Base.metadata.create_all() de init_db()
# Mantener solo: engine creation, sessionmaker, get_db dependency
```

#### Paso 3: Flujo de Desarrollo Correcto
```bash
# Cambio en modelo (ej. agregar columna)
# 1. Editar models.py
# 2. Generar migración
alembic revision --autogenerate -m "add_column_x_to_table_y"
# 3. Revisar SQL generado (¡crítico! autogenerate a veces falla en SQLite)
# 4. Aplicar en desarrollo
alembic upgrade head
# 5. Commit: models.py + migration file
```

#### Paso 4: Flujo de Producción (Deploy)
```bash
# En CI/CD o servidor:
# 1. Backup BD (pg_dump / sqlite3 .dump)
# 2. Aplicar migraciones
alembic upgrade head
# 3. Si falla: rollback automático con alembic downgrade -1 + restore backup
# 4. Seed SOLO si es primera instalación (feature flag o tabla de control)
```

#### Paso 5: Configuración Alembic Robusta
```python
# backend/alembic/env.py — mejoras necesarias:
# - compare_type=True, compare_server_default=True (detecta más cambios)
# - include_schemas=True (si multi-schema)
# - render_as_batch=True (para SQLite batch mode en alter table)
# - process_revision_directives para evitar migraciones vacías
```

### Checklist de Verificación (Definición de Done)
- [x] `alembic/versions/` tiene ≥ 1 migración (`initial_schema_baseline`)
- [x] `init_db()` en `database.py` usa `alembic upgrade head` en vez de `Base.metadata.create_all()`
- [x] `alembic upgrade head` aplica sin errores en BD limpia → 48 tablas creadas
- [x] `alembic downgrade -1` revierte correctamente → solo queda `alembic_version`
- [x] Datos de usuario **persisten** tras `upgrade head` (no se borra BD) → 5 usuarios intactos
- [x] Cambio de modelo → `alembic revision --autogenerate` genera SQL correcto → probado y revertido
- [ ] ~~Seed data via migración `data` Alembic~~ → **EXCLUIDO**: el seed con FeatureFlag (`seed_data()` + `seed_pet_supplies()` + `seed_feature_flags()`) es idempotente, no se ejecuta en boot normal gracias al flag `system.initial_seed_done`, y es más apropiado que `op.bulk_insert()` porque los timestamps son dinámicos y los datos son demo (no esquema).

---

## CONCLUSIÓN
La auditoría full_audit_mobile_wo_chat.md subestima la gravedad: reporta 5.5/10 pero la realidad es 4.5/10 por:
- Touch targets rotos en componentes core (WCAG AA fail)
- Pull-to-refresh cero implementaciones
- Keyboard handling cero
- PWA instalable pero invisible al usuario
- Haptic token presente pero no sistemático
La auditoría full_optimize_wo_chat.md sobreestima completitud: marca secciones 5-14 como "✅ Resuelto" pero mobile-first UX (Sprint 5+) no existe.
Prioridad absoluta: Sprint 5 (Mobile Native) debe ejecutarse ya — son 15 defectos P0/P1 que impiden que la app se sienta nativa en móvil. Backend está listo; todo el trabajo es frontend.

---

## PLAN DE ITERACIONES — MOBILE NATIVE (SPRINT 5+)

> **Objetivo:** Resolver todos los defectos P0/P1/P2 de la auditoría real (4.5/10 → 9+/10)
> **Metodología:** Iteraciones de 1-2 días cada una, con verificación `npm run lint && npx tsc --noEmit` al final de cada iteración
> **Orden:** P0 (bloqueantes) → P1 (UX degradada) → P2 (accesibilidad/pulido)

---

### ITERACIÓN 0: Base de Datos — Alembic Migraciones (BLOQUEANTE PRODUCCIÓN) — **Día 0 (ANTES de Sprint 5)**

**Objetivo:** Establecer migraciones versionadas con Alembic, eliminar `create_all()` + seed automático, garantizar persistencia de datos entre deploys

**Archivos a modificar:**
| Archivo | Acción |
|---------|--------|
| `backend/app/main.py` | **Eliminar** líneas 35-60 (`init_db()` + seed gate) |
| `backend/app/database.py` | **Eliminar** `Base.metadata.create_all(bind=engine)` de `init_db()` |
| `backend/alembic/env.py` | Configurar `compare_type=True`, `compare_server_default=True`, `render_as_batch=True` |
| `backend/alembic/versions/` | Generar migración baseline inicial |

**Pasos exactos:**
```bash
cd backend

# 1. Verificar que models.py refleja estado ACTUAL de la BD
# 2. Generar migración baseline (crea todas las tablas actuales)
alembic revision --autogenerate -m "initial_schema_baseline"

# 3. Revisar archivo generado en alembic/versions/XXXX_initial_schema_baseline.py
#    - Debe tener create_table para TODAS las tablas: users, posts, artifacts, books, pets, transactions, etc.
#    - Debe incluir índices, foreign keys, constraints

# 4. Marcar como aplicada (stamp) SIN ejecutar — la BD ya existe con ese esquema
alembic stamp head

# 5. Probar: borrar nexus.db, recrear vacía, aplicar migraciones
rm nexus.db
alembic upgrade head
# Debe crear esquema idéntico al actual

# 6. Probar rollback
alembic downgrade -1
# Debe revertir cleanly

# 7. Probar cambio real: agregar campo prueba en models.py → autogenerate → upgrade
```

**Cambio en flujo de seed data:**
- Crear migración `data` separada: `alembic revision -m "seed_initial_data"` (sin autogenerate)
- En `upgrade()`: `op.bulk_insert()` para datos mínimos (roles, config, feature flags)
- En `downgrade()`: `op.execute("DELETE FROM ...")`
- **NO** usar `seed.py` en startup nunca más

**Verificación obligatoria:**
- [x] `alembic upgrade head` en BD limpia → esquema completo sin errores
- [x] `alembic downgrade -1` → rollback limpio
- [x] Datos de usuario persisten tras `upgrade head` (no se borra BD)
- [x] `main.py` arranca sin `create_all` ni seed
- [x] Cambio de modelo real → `autogenerate` → SQL correcto → `upgrade` funciona

---

### ITERACIÓN 1: Touch Targets System (P0) — **Día 1-2**

**Objetivo:** Enforzar 44px mínimo (48px en coarse pointer) en TODOS los componentes interactivos

**Archivos a modificar:**
| Archivo | Cambio | Línea aprox |
|---------|--------|-------------|
| `components/ui/Avatar.tsx` | `sm: w-11 h-11` (44px) | 18-22 |
| `components/ui/NumberStepper.tsx` | `sm: w-11 h-11`, `md: w-11 h-11`, `lg: w-12 h-12` (48px) | 24-38 |
| `components/ui/TabGroup.tsx` | `min-h-[44px]` en tabs, `min-h-[48px]` @media coarse | 85-95 |
| `components/ui/BottomNav.tsx` | Items `min-h-[44px]` / `min-h-[48px]` coarse | 25+ |
| `components/ui/Modal.tsx` | Close button `w-11 h-11` | 85 |
| `components/ui/SearchBar.tsx` | `sm: py-3` (44px), `md: py-3.5` | 17 |
| `components/ui/MaterialIcon.tsx` | Wrapper base `p-3` (44px hit area) | - |
| `components/ui/Button.tsx` | Verificar `py-3 px-6` ≥ 44px (ya OK) | - |
| `components/ui/FAB.tsx` | Ya 64px ✅ | - |

**Design tokens (globals.css):**
```css
/* Agregar en :root (línea ~115) */
--touch-target-min: 44px;
--touch-target-min-coarse: 48px;

/* Clase utilitaria */
.touch-target {
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
}
@media (pointer: coarse) {
  .touch-target {
    min-width: var(--touch-target-min-coarse);
    min-height: var(--touch-target-min-coarse);
  }
}
```

**Verificación:** `npm run lint && npx tsc --noEmit` + test manual en móvil (Chrome DevTools device toolbar)

---

### ITERACIÓN 2: Pull-to-Refresh Hook + Integración (P0) — **Día 2-3**

**Objetivo:** Hook reutilizable `usePullToRefresh` + integrar en TODAS las vistas de lista

**Nuevo archivo:** `hooks/usePullToRefresh.ts`
```typescript
// Basado en useSwipeable + visualViewport
// threshold: 80px, resistencia visual, haptic light al trigger
// Exports: { isPulling, pullProgress, onRefresh }
```

**Vistas a integrar (añadir wrapper `<PullToRefresh onRefresh={...}>`):**
| Vista | Archivo | Query a invalidar |
|-------|---------|-------------------|
| Dashboard | `app/(main)/dashboard/page.tsx` | `dashboardStats`, `posts` |
| Profile PostsFeed | `app/(main)/profile/[id]/components/PostsFeed.tsx` | `userPosts` |
| News All | `app/(main)/news/all/page.tsx` | `articles` |
| Borgin & Burkes | `app/(main)/marketplace/borgin-burkes/page.tsx` | `products` |
| Flourish & Blotts | `app/(main)/marketplace/flourish-blotts/page.tsx` | `books` |
| Treasury | `app/(main)/treasury/page.tsx` | `transactions`, `balance` |
| Admin tables | `app/(main)/admin/*/page.tsx` | respective queries |
| Notifications | `app/(main)/notifications/page.tsx` | `notifications` |

**Verificación:** Pull-down en cada vista → spinner + haptic + refetch + toast success

---

### ITERACIÓN 3: Virtual Keyboard Handling (P0) — **Día 3-4**

**Objetivo:** Hook `useVisualViewport` + ajustar layout dinámicamente al abrir/cerrar teclado

**Nuevo archivo:** `hooks/useVisualViewport.ts`
```typescript
// Expone: keyboardHeight, isKeyboardOpen, viewportHeight
// Listeners: visualViewport.onresize, visualViewport.onscroll
// Cleanup en unmount
```

**Integración en componentes:**
| Componente | Ajuste necesario |
|------------|------------------|
| `AppShell.tsx` | `pb-[calc(var(--bottomnav-h)+env(keyboard-inset))]` cuando `isKeyboardOpen` |
| `BottomSheet.tsx` | `translateY(-keyboardHeight)` para mantener visible |
| `Modal.tsx` | `max-h-[calc(100dvh-keyboardHeight-4rem)]`, scroll interno |
| `FAB.tsx` | `bottom-[calc(20px+keyboardHeight)]` o `hidden` si `keyboardHeight > 0` |
| `ToastViewport.tsx` | `bottom-[calc(20px+keyboardHeight)]` |

**CSS helper (globals.css):**
```css
.keyboard-aware {
  padding-bottom: calc(var(--bottomnav-h) + env(keyboard-inset-height, 0px));
}
```

**Verificación:** Abrir teclado en Login, TransferTab, PostComposer, CommentSection, SearchBar → FAB/BottomNav/Modal no ocultan inputs, no hay solapamiento

---

### ITERACIÓN 4: PWA Install UX (P0) — **Día 4**

**Objetivo:** Usuario ve prompt de instalación + botón "Instalar" funcional

**Cambios en `hooks/usePWA.ts`:**
```typescript
// Agregar beforeinstallprompt handler
const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

useEffect(() => {
  const handler = (e: BeforeInstallPromptEvent) => {
    e.preventDefault();
    setInstallPrompt(e);
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);

// Función install() que llama prompt.prompt()
```

**Nuevo componente:** `components/ui/PWAInstallBanner.tsx`
```tsx
// Banner no intrusivo (bottom, glass-card, dismissible)
// Botón "Instalar" → llama installPrompt.prompt()
// Auto-hide tras install (appinstalled event)
// No mostrar si ya está en standalone mode
```

**Integración:** Mostrar en `TopBar.tsx` o `AppShell.tsx` cuando `installPrompt` disponible

**Verificación:** Chrome DevTools → Application → Manifest → "Add to home screen" → banner aparece → click → instala → abre como app standalone

---

### ITERACIÓN 5: Haptic Feedback Sistémico (P0) — **Día 5**

**Objetivo:** Haptic en TODAS las interacciones táctiles (50+ puntos)

**Base existente:** `lib/haptics.ts` ✅ (7 patrones: light, medium, heavy, selection, success, warning, error + `withHaptic()`)

**Nuevos componentes/wrappers:**
| Archivo | Descripción |
|---------|-------------|
| `components/ui/HapticButton.tsx` | Extiende `Button` con `hapticPattern?: keyof typeof haptics` (default: 'light') |
| `hooks/useHapticFeedback.ts` | `useHapticFeedback(pattern)` → retorna `() => haptics[pattern]()` para elementos no-button |

**Aplicación masiva (buscar-reemplazar patrones):**
| Target | Pattern | Haptic |
|--------|---------|--------|
| `Button` (todos) | `onClick` → `onClick={withHaptic('light', onClick)}` | light |
| `TabGroup` tabs | `onClick` tab change | selection |
| `NumberStepper` ± | `onClick` increment/decrement | selection |
| `BottomNav` items | `onClick` navigation | selection |
| `FAB` | `onClick` | light |
| `Modal` actions | primary=success, secondary=light, danger=heavy | según acción |
| `SwipeActionRow` (futuro) | swipe action trigger | selection |
| `PullToRefresh` | onRefresh trigger | light |
| Form submits | `onSubmit` success/error | success/error |
| `Avatar` clickable | `onClick` | light |
| Filter chips | `onClick` toggle | selection |

**Verificación:** Recorrer app completa en móvil → cada tap/scroll action tiene feedback táctil apropiado

---

### ITERACIÓN 6: Formularios Mobile-First (P1) — **Día 5-6**

**Objetivo:** `inputMode`, `autocomplete`, `enterKeyHint` en TODOS los inputs

**Archivos y cambios exactos:**

| Archivo | Input | Atributos a agregar |
|---------|-------|---------------------|
| `app/(auth)/login/page.tsx` | email | `inputMode="email" autoComplete="email" enterKeyHint="next"` |
| `app/(auth)/login/page.tsx` | password | `autoComplete="current-password" enterKeyHint="go"` |
| `components/domain/Treasury/TransferTab.tsx` | amount | `inputMode="numeric" autoComplete="off" enterKeyHint="done"` |
| `components/domain/Treasury/DepositTab.tsx` | amount | `inputMode="numeric" autoComplete="off" enterKeyHint="done"` |
| `components/domain/Treasury/WithdrawTab.tsx` | amount | `inputMode="numeric" autoComplete="off" enterKeyHint="done"` |
| `components/ui/SearchBar.tsx` | search | `inputMode="search" autoComplete="off" enterKeyHint="search"` ✅ (ya) |
| `components/domain/Profile/PostComposer.tsx` | textarea | `inputMode="text" autoComplete="off" enterKeyHint="send"` |
| `components/domain/Profile/CommentSection.tsx` | textarea | `inputMode="text" autoComplete="off" enterKeyHint="send"` |
| `components/domain/Profile/ProfileDetails.tsx` | inline inputs | `enterKeyHint="done"` (líneas 41-56) |
| `components/domain/Profile/EditProfileModal.tsx` | todos inputs | `inputMode` + `autoComplete` según tipo |

**Verificación:** Abrir teclado en cada formulario → teclado correcto (numérico para amount, email para login, etc.), tecla "Go/Next/Done" funcional

---

### ITERACIÓN 7: Skeleton Loaders (P1) — **Día 6-7**

**Objetivo:** Componente `Skeleton` reutilizable + reemplazar todos los `animate-pulse` manuales

**Nuevo archivo:** `components/ui/Skeleton.tsx`
```tsx
// Variantes: 'text' | 'card' | 'avatar' | 'circular' | 'table-row' | 'rectangular'
// Props: variant, width?, height?, className?
// Usa CSS @keyframes shimmer (no animate-pulse) para mejor performance
// Reduce motion: opacity 0.5 estático si prefers-reduced-motion
```

**Reemplazos en páginas:**
| Página/Componente | Loading actual | Nuevo Skeleton |
|-------------------|----------------|----------------|
| `AdminCrudTable.tsx:60-70` | `animate-pulse` tr | `<Skeleton variant="table-row" />` × 5 |
| `BorginBurkesPage.tsx` grid | `animate-pulse` cards | `<Skeleton variant="card" />` × 6 |
| `FlourishBlottsPage.tsx` grid | `animate-pulse` cards | `<Skeleton variant="card" />` × 6 |
| `NewsAllPage.tsx` grid | `animate-pulse` | `<Skeleton variant="card" />` × 4 |
| `PostsFeed.tsx` | `animate-pulse` | `<Skeleton variant="card" />` × 3 |
| `ProfilePage.tsx` stats | `animate-pulse` | `<Skeleton variant="text" />` × 4 |
| `HeroCarousel.tsx` | `animate-pulse` | `<Skeleton variant="rectangular" className="aspect-[16/9]" />` |

**Verificación:** Network throttling (Slow 3G) → skeletons aparecen suavemente, no layout shift, reduce-motion desactiva animación

---

### ITERACIÓN 8: Virtualización Listas (P1) — **Día 7-8**

**Objetivo:** `react-window` / `react-virtuoso` en listas > 20 items

**Instalación:** `npm i react-window @types/react-window` (ya en deps?)

**Implementaciones:**

| Lista | Componente nuevo | Archivo |
|-------|------------------|---------|
| Borgin Artifacts | `VirtualizedArtifactGrid` (FixedSizeGrid) | `components/domain/BorginBurkes/ArtifactCardGrid.tsx` |
| Flourish Books | `VirtualizedBookGrid` (FixedSizeGrid) | `components/domain/FlourishBlotts/BookCardGrid.tsx` |
| Profile PostsFeed | `VirtualizedPostFeed` (VariableSizeList) | `app/(main)/profile/[id]/components/PostsFeed.tsx` |
| Admin Tables | `VirtualizedAdminTable` (si > 50 rows) | `components/ui/AdminCrudTable.tsx` |

**Patrón común:**
```tsx
import { FixedSizeGrid } from 'react-window';

const VirtualizedGrid = ({ items, children, itemHeight = 300, columns = 2 }) => (
  <FixedSizeGrid
    height={600} // o calc
    width="100%"
    itemCount={items.length}
    itemData={items}
    columnCount={columns}
    rowHeight={itemHeight}
    columnWidth={width / columns}
  >
    {({ index, style }) => (
      <div style={style}>{children(items[index])}</div>
    )}
  </FixedSizeGrid>
);
```

**Verificación:** 100+ items → scroll 60fps, memoria estable, no renderiza items fuera de viewport

---

### ITERACIÓN 9: Focus-Visible + ARIA Completo (P2) — **Día 8-9**

**Objetivo:** Anillo de foco visible en TODOS los componentes interactivos + ARIA labels

**CSS (globals.css):**
```css
@layer utilities {
  .focus-visible-ring {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface;
  }
}
```

**Aplicar `.focus-visible-ring` a:**
| Componente | Selector |
|------------|----------|
| `TabGroup` tabs | `[role="tab"]` |
| `NumberStepper` botones | `button` |
| `Avatar` (si clickable) | `[role="button"], button` |
| Filter chips | `button[aria-pressed]` |
| `FAB` | `button` |
| Icon buttons sueltos | `button:has(> .material-symbols-outlined)` |
| `BottomNav` items | `button` |
| `Modal` close | `button[aria-label="Cerrar"]` |
| `LanguageSelector` | `button` |
| `Dropdown` items | `[role="menuitem"]` |

**ARIA en `MaterialIcon.tsx`:**
```tsx
// Si decorative: role="img" aria-hidden="true"
// Si semántico (button sin label visible): aria-label={label} (prop requerida)
```

**Skip link (app/layout.tsx):**
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 btn-primary">
  Saltar al contenido principal
</a>
<main id="main-content" className="min-h-content">...</main>
```

**Verificación:** Tab navigation completa → anillo visible en CADA elemento interactivo, screen reader anuncia labels correctos

---

### ITERACIÓN 10: Web Share API + Offline (P2) — **Día 9-10**

**Web Share API (frontend):**
| Ubicación | Cambio |
|-----------|--------|
| `ArticleDetailPage` compartir btn | `navigator.share({ title, text: excerpt, url })` → fallback `clipboard.writeText` |
| `SharePostModal` | Idem |
| `PostCard` share | Idem |
| `HeroCarousel` share (si existe) | Idem |

**Service Worker Offline (sw.js):**
```javascript
// Agregar a cacheFirst: páginas HTML críticas ('/', '/dashboard', '/treasury', '/profile', '/news')
// Agregar background sync para mutaciones offline (posts, comments, transfers)
// Agregar periodic sync para noticias (si usuario lo permite)
// Toast "Nueva versión disponible" en controllerchange
```

**Verificación:** 
- Share btn → native share sheet en móvil, clipboard en desktop
- Modo avión → navegar a páginas cachadas → mutations se encolan → online → sync automático
- Deploy nueva versión → toast "Actualización disponible" → click → reload

---

### ITERACIÓN 11: CartStore Persistencia + Admin Delete Confirm (P2) — **Día 10**

**CartStore (components/stores/cartStore.ts):**
```typescript
// Agregar persist middleware
import { persist } from 'zustand/middleware';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({ ... }),
    { name: 'hogwarts-cart', storage: createJSONStorage(() => localStorage) }
  )
);
```

**AdminCrudTable delete confirm:**
```tsx
// Reemplazar onClick directo en botón delete por:
<ConfirmDialog
  isOpen={deleteConfirmId === row.id}
  onClose={() => setDeleteConfirmId(null)}
  onConfirm={() => { onDelete(row.id); setDeleteConfirmId(null); }}
  title="Eliminar elemento"
  description="Esta acción no se puede deshacer."
  variant="danger"
/>
```

---

### ITERACIÓN 12: LanguageSelector i18n + Cleanup (P2) — **Día 10-11**

**LanguageSelector:** Conectar a `next-intl` o similar (fuera de scope móvil, pero DX)

**Cleanup:**
- Eliminar `.parchment-texture` de `globals.css` si no se usa (buscar en codebase)
- Verificar `contraste modo oscuro` en runtime (Lighthouse CI)

---

## TRACKING DE PROGRESO

| Iteración | Estado | Fecha inicio | Fecha fin | Verificación |
|-----------|--------|--------------|-----------|--------------|
| 0. **Alembic Migraciones (BLOQUEANTE)** | ✅ Completado | 2026-08-03 | 2026-08-03 | `alembic upgrade/downgrade + data persist` |
| 1. Touch Targets | ✅ Completado | 2026-08-03 | 2026-08-03 | `lint + tsc + mobile test` |
| 2. Pull-to-Refresh | ✅ Completado | 2026-08-03 | 2026-08-03 | `lint + tsc + 7 vistas` |
| 3. Virtual Keyboard | ✅ Completado | 2026-08-03 | 2026-08-03 | `lint + tsc + 5 formularios` |
| 4. PWA Install UX | ✅ Completado | 2026-08-03 | 2026-08-03 | `lint + tsc + install flow` |
| 5. Haptic Sistémico | ✅ Completado | 2026-08-03 | 2026-08-03 | `lint + tsc + 50+ puntos` |
| 6. Formularios Mobile | ⏳ Pendiente | | | `lint + tsc + 10 inputs` |
| 7. Skeletons | ⏳ Pendiente | | | `lint + tsc + 7 páginas` |
| 8. Virtualización | ⏳ Pendiente | | | `lint + tsc + 4 listas` |
| 9. Focus/ARIA/Skip | ⏳ Pendiente | | | `lint + tsc + aXe + tab nav` |
| 10. Web Share + Offline | ⏳ Pendiente | | | `lint + tsc + share + offline` |
| 11. Cart Persist + Admin | ⏳ Pendiente | | | `lint + tsc + refresh + delete` |
| 12. i18n + Cleanup | ⏳ Pendiente | | | `lint + tsc + build` |

---

## COMANDOS DE VERIFICACIÓN OBLIGATORIOS (CADA ITERACIÓN)

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
# Opcional: npm run test (si hay tests)
# Opcional: npx lighthouse http://localhost:3000 --only-categories=accessibility,performance,pwa
```

**No pasar a la siguiente iteración hasta que ambos comandos pasen sin errores.**

---

## DEFINICIÓN DE "DONE" GLOBAL

- [x] **Alembic migraciones funcionando** — `upgrade head` en BD limpia, rollback, persistencia de datos
- [x] **Sin `create_all()` en database.py** — `init_db()` ejecuta `alembic upgrade head` + `_ensure_indexes` + `_ensure_fts`; seed vía FeatureFlag idempotente en `main.py`
- [x] Touch targets ≥ 44px (48px coarse) en 100% componentes interactivos
- [x] Pull-to-refresh funcional en 100% vistas de lista (7+ vistas)
- [x] Teclado virtual no oculta FAB/BottomNav/Modal/Botones en 100% formularios
- [x] PWA install prompt visible + funcional
- [x] Haptic feedback en ≥ 50 interacciones táctiles
- [ ] `inputMode`/`autocomplete`/`enterKeyHint` en 100% inputs
- [ ] Skeletons en 100% loading states (0 `animate-pulse` manual)
- [ ] Virtualización en 100% listas > 20 items
- [ ] Focus-visible ring en 100% elementos interactivos + skip link + ARIA completo
- [ ] Web Share API nativa + fallback clipboard
- [ ] Offline navigation + background sync funcional
- [ ] Cart persiste refresh + Admin delete con confirm dialog
- [ ] `npm run lint && npx tsc --noEmit` → 0 errores
- [ ] Lighthouse PWA/Accessibility/Performance ≥ 90

---

**Estimación total: 12-13 días de trabajo enfocado (Iteración 0 + 12 iteraciones móviles = 1 iteración/día aprox)**
**Resultado esperado: Mobile UX 9.5+/10, producción-ready con BD versionada y persistente** 