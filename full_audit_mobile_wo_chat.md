# Auditoría Mobile UX/UI — Hogwarts Nexus Lumiére (Vistas No-Chat)

> **Fecha:** 2026-07-31  
> **Alcance:** Todas las vistas excepto `/messages` (chat)  
> **Metodología:** Revisión de código completo (frontend Next.js + Tailwind + componentes)  
> **Criterio:** Patrones mobile *más allá* de responsive layout (gestos, platform APIs, feedback, accesibilidad, performance, PWA, formularios)

---

## TL;DR — Resumen Ejecutivo

| Métrica | Estado |
|---------|--------|
| **Responsive layout** | ✅ Implementado (Sidebar lg+, BottomNav <md, CSS vars con `dvh`/`safe-area`) |
| **Touch targets ≥44px** | ⚠️ Parcial (icon buttons 40px, Avatar sm 40px, algunos modales 36px) |
| **Gestos nativos (swipe, pull-to-refresh, pinch)** | ❌ Ausentes |
| **Haptic feedback** | ❌ Ausente |
| **Virtual keyboard handling** | ❌ Ausente (`visualViewport` no usado) |
| **PWA / Service Worker / Push** | ❌ Ausente (sin manifest, SW, offline, install prompt) |
| **Web Share API** | ❌ Parcial (solo `clipboard.writeText` en artículo) |
| **Accesibilidad (reduced-motion, focus-visible, aria)** | ⚠️ Parcial |
| **Performance mobile (bundle, imágenes, lazy, skeletons)** | ⚠️ Parcial |
| **Formularios mobile-first** | ⚠️ Parcial (falta `inputMode`, `autocomplete`, steppers) |

**Puntuación general mobile UX: 5.5/10** — Base responsive sólida, pero falta capa de "mobile-native feel".

---

## ✅ Lo Que Ya Está Bien (Quick Wins Log)

| Patrón | Ubicación | Evidencia |
|--------|-----------|-----------|
| Safe-area inset (`env(safe-area-inset-*)`) | `app/layout.tsx:39`, `globals.css:339`, `BottomNav.tsx:25` | `viewportFit: "cover"`, `pb-safe`, `pb-[var(--bottomnav-h)]` |
| Layout variables con `dvh` | `globals.css:115-137` | `--topbar-h`, `--bottomnav-h`, `.h-content`, `.min-h-content` |
| BottomNav solo mobile | `BottomNav.tsx:25` | `md:hidden fixed bottom-0` |
| Sidebar drawer mobile | `Sidebar.tsx:93-101` | `lg:hidden fixed inset-0 transform translate-x` |
| Perfil: acciones full-width en mobile | `ProfileHeader.tsx:120-121` | `md:hidden mt-4 flex gap-2 [&>*]:flex-1` |
| AdminCrudTable: cards en mobile | `AdminCrudTable.tsx:88-116` | `md:hidden divide-y` cards vs tabla desktop |
| HeroCarousel: pausa auto-rotate en interacción | `BorginBurkes/HeroCarousel.tsx:104-115` | `isUserInteracting` state |
| QuickNav: horizontal scroll con snap | `QuickNav.tsx:20-36` | `overflow-x-auto snap-x` |
| Modal portal + body scroll lock | `Modal.tsx:95-131` | `createPortal`, `document.body.style.overflow` |
| TabGroup navegación teclado | `TabGroup.tsx:28-48` | ArrowLeft/Right, Home, End |
| ToastViewport posición adaptativa | `ToastViewport.tsx:37` | `bottom-20 md:bottom-6` |
| FAB evita BottomNav | `FAB.tsx:12-13` | `bottom-20` / `bottom-center` |
| SearchBar debounce integrado | `SearchBar.tsx:60-65` | `debounceMs` prop |
| ErrorBoundary temático | `ErrorBoundary.tsx:46-70` | GlassCard fallback con retry |
| Skeleton loading coherente | `Skeleton.tsx`, múltiples páginas | `animate-pulse` variants |
| EmptyState con CTA | `EmptyState.tsx`, muchas vistas | Icon + title + desc + action button |
| Toast position adapta safe-area | `globals.css:339`, `ToastViewport.tsx:37` | `pb-safe` / `bottom-20` |
| Optimistic UI con rollback | `Treasury/*.tsx`, `Profile/[id]/page.tsx` | `applyOptimisticBalance`, `queryClient.setQueryData` |
| Sticky balance bar compacta | `treasury/page.tsx:122-132` | `sticky top-2` compacta |

---

## 🔴 Hallazgos Críticos (Severidad: Alta)

### 1. Falta PWA Completa — Sin Manifest, SW, Push, Offline
**Impacto:** Usuarios no pueden instalar la app, no reciben notificaciones con app cerrada, no funciona offline.  
**Archivos:** `app/layout.tsx` (no hay manifest), `public/` (sin manifest.json, sin sw.js)  
**Recomendación:**  
```json
// public/manifest.json
{
  "name": "Hogwarts Nexus Lumiére",
  "short_name": "Nexus",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#0e3b60",
  "theme_color": "#0e3b60",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "purpose": "any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title", "text": "text", "url": "url",
      "files": [{ "name": "files", "accept": ["image/*", "video/*"] }]
    }
  }
}
```
```html
<!-- app/layout.tsx head -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0e3b60" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### 2. Sin Push Notifications Nativas (Web Push + VAPID + APNs/FCM)
**Impacto:** En iOS/Android, cuando la app pasa a background, WebSocket se cierra (~30s iOS, Doze Android). Sin push, mensajes y notificaciones se pierden hasta que el usuario abre la app.  
**Archivos:** `TopBar.tsx:79-85` (polling 45s — inútil en background), `notificationStore.ts` (solo in-app)  
**Recomendación:** Implementar Service Worker con `push` event, backend VAPID, y fallback APNs/FCM. Ver `chat_optimize.md` §9.3-9.4.

### 3. `useUnsavedChangesGuard` Usa `window.confirm()` (Mal UX Mobile)
**Impacto:** Los diálogos nativos `confirm()` son bloqueantes, no accesibles, y en mobile ocupan toda la pantalla sin branding.  
**Archivo:** `hooks/useUnsavedChangesGuard.ts:46-47`  
**Recomendación:** Usar `ConfirmDialog` (ya existe en `components/ui/ConfirmDialog.tsx`):
```typescript
// En lugar de:
const confirmed = window.confirm(message);
// Usar:
const { show } = useConfirmStore.getState();
return new Promise((resolve) => {
  show({
    title: "Cambios sin guardar",
    message,
    variant: "secondary",
    onConfirm: () => resolve(true),
    onCancel: () => resolve(false), // requiere añadir onCancel al store
  });
});
```

---

## 🟠 Hallazgos Importantes (Severidad: Media)

### 4. Sin Gestos Nativos (Swipe, Pull-to-Refresh, Pinch, Long-Press)
| Gesture | Vistas Afectadas | Recomendación |
|---------|-----------------|---------------|
| **Swipe horizontal** | HeroCarousel (Borgin/Flourish), QuickNav, TabGroup | Añadir `onTouchStart/Move/End` o usar `react-swipeable` |
| **Pull-to-refresh** | Profile feed, News all, Marketplace catalog, Notifications | Wrapper `PullToRefresh` con `visualViewport` o IntersectionObserver en top |
| **Swipe-to-dismiss** | Modals (EditProfile, AllFriends), Lightbox, CartSidebar | Detectar swipe down/right → `onClose()` |
| **Long-press context menu** | PostCard (edit/delete), ArtifactCard, PetCard, Friend items | `onTouchStart` + timer 500ms → mostrar Popover/ContextMenu |
| **Pinch-to-zoom** | Lightbox, artículo imagen, HeroCarousel product image | Usar `react-pinch-zoom` o `gesture` events en Lightbox |
| **Swipe actions list** | Notifications, Profile feed, AllFriends, Marketplace "Mis artículos" | `SwipeActionRow` component (delete, mark-read, archive) |

**Ejemplo swipe carousel:**
```tsx
// En HeroCarousel ProductSlide
const swipeRef = useSwipeable({
  onSwipedLeft: onNextSlide,
  onSwipedRight: onPrevSlide,
  trackMouse: true,
  preventScrollOnSwipe: true,
});
<div ref={swipeRef} ...>
```

### 5. Inputs No Optimizados para Teclados Virtuales
**Impacto:** Teclado incorrecto (qwerty vs numérico), sin autocomplete, sin hints de acción.  
**Archivos:**
- `treasury/DepositTab.tsx:63-74` — `<input type="number">` sin `inputMode="numeric"`
- `treasury/TransferTab.tsx:185-197` — mismo problema
- `auth/login/page.tsx:65-72` — email sin `autocomplete="email"`, password sin `autocomplete="current-password"`
- `ProfileDetails.tsx:41-56` — InlineEditable sin `enterKeyHint="done"`
- `news/[id]/page.tsx:280-286` — textarea sin `enterKeyHint="send"`

**Recomendación:**
```tsx
// Numérico (depósitos, transferencias)
<input 
  type="text" 
  inputMode="numeric" 
  pattern="[0-9]*"
  enterKeyHint="next"
/>

// Email
<input 
  type="email" 
  autoComplete="email" 
  autoCapitalize="none"
  enterKeyHint="next"
/>

// Password
<input 
  type="password" 
  autoComplete="current-password" 
  enterKeyHint="next"
/>

// Search
<input 
  type="search" 
  autoComplete="off"
  enterKeyHint="search"
/>

// Textarea composer
<textarea 
  enterKeyHint="send"
  autoComplete="off"
/>
```

### 6. Falta `prefers-reduced-motion` en Animaciones
**Impacto:** Usuarios con vértigo/mareo sufren con animaciones (MagicalFloat, InnerSparkle, LevelUpCelebration, toast-in, highlight-pulse).  
**Archivos:** `globals.css:353-367` (float), `369-379` (sparkle), `392-404` (pulse-critical), `406-416` (toast-in), `419-449` (level-up)  
**Recomendación:**
```css
@media (prefers-reduced-motion: reduce) {
  .magical-float,
  .inner-sparkle::after,
  .animate-pulse-critical,
  .highlight-message,
  .animate-[toast-in_0.2s_ease-out],
  [style*="lvlup"] {
    animation: none !important;
    transition: none !important;
  }
}
```

### 7. Modales Personalizados No Reusan `Modal` (Inconsistencia + Accesibilidad)
**Impacto:** `EditProfileModal.tsx`, `AllFriendsModal.tsx` implementan su propio overlay + portal + focus management → duplicación de código, posible falta de focus trap, Escape handler, aria.  
**Archivos:** `Profile/EditProfileModal.tsx:80-232`, `Profile/AllFriendsModal.tsx:129-276`  
**Recomendación:** Refactorizar para usar `Modal` component:
```tsx
// EditProfileModal → usar Modal con size="lg"
<Modal open={isOpen} onClose={onClose} size="lg" title="Editar Perfil">
  <form>...</form>
</Modal>
```

### 8. Lightbox Sin Navegación Teclado / Gestos / Zoom
**Impacto:** En mobile, Lightbox no se cierra con Escape (no tiene handler), no tiene pinch-to-zoom, no tiene swipe-to-dismiss.  
**Archivo:** `Lightbox.tsx:12-35`  
**Recomendación:** Añadir:
```tsx
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}, [onClose]);

// En el contenedor:
<div 
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  className="touch-action-none"
>
```

### 9. FAB No Respeta Safe-Area Bottom en Dispositivos Notch
**Impacto:** En iPhone con Dynamic Island / home indicator, FAB en `bottom-20` puede solaparse.  
**Archivo:** `FAB.tsx:12-13`  
**Recomendación:**
```tsx
const positionClasses = {
  "bottom-right": "right-6 bottom-20 pb-safe",
  "bottom-center": "bottom-20 left-1/2 -translate-x-1/2 pb-safe",
};
```

### 10. CartSidebar Debería Ser Bottom Sheet en Mobile
**Impacto:** Drawer lateral en mobile (`fixed right-0 top-0 h-full`) obliga a estirar pulgar; bottom sheet es patrón nativo.  
**Archivo:** `BorginBurkes/CartSidebar.tsx:40-44`  
**Recomendación:** Crear `BottomSheet` component reutilizable:
```tsx
// Mobile: slide from bottom, full-width, drag handle
// Desktop: side drawer (actual)
```

### 11. Avatar `alt=""` Vacío Cuando No Hay Alt
**Impacto:** Screen readers anuncian "image" sin contexto.  
**Archivo:** `Avatar.tsx:66` — `alt={alt ?? ""}`  
**Recomendación:**
```tsx
alt={alt ?? (initials ? `Avatar de ${initials}` : "Avatar de usuario")}
```

### 12. Filter Chips Sin `aria-pressed` / `role="button"`
**Impacto:** No accesibles para screen readers en filtros de Marketplace, News all, etc.  
**Archivos:** `BorginBurkes/page.tsx:254-266`, `FlourishBlotts/page.tsx:252-264`, `news/all/page.tsx:69-93`  
**Recomendación:**
```tsx
<button
  role="button"
  aria-pressed={activeFilter === f}
  className={...}
>
  {f}
</button>
```

### 13. Infinite Scroll `style={{ height }}` Calculation Frágil en News
**Impacto:** `VirtualizedArticleGrid` usa altura fija calculada en render (`Math.max(activeTotal * 107 + 100, 400)`) — puede desbordar o dejar huecos en mobile con cambio de orientación.  
**Archivo:** `news/page.tsx:398`, `news/all/page.tsx:146`  
**Recomendación:** Usar `virtuoso` con `contentWindow` o `style={{ height: '100%' }}` + contenedor `h-content`.

### 14. Sin Prefetch en Hover/TouchStart para Navegación
**Impacto:** Clicks en mobile sienten latencia (sin hover). `Link` de Next.js prefetchea en hover (desktop), pero no en touch.  
**Recomendación:** Añadir `onTouchStart` a links críticos:
```tsx
<Link 
  href="/messages" 
  onTouchStart={() => router.prefetch('/messages')}
>
```

### 15. ToastViewport `aria-live="polite"` — Puede Perderse en Mobile
**Impacto:** Si usuario está en otra app/pestaña, toast no se anuncia.  
**Archivo:** `ToastViewport.tsx:35`  
**Recomendación:** Para toasts críticos (errores), usar `aria-live="assertive"` + vibración:
```tsx
const isCritical = t.variant === 'error';
<div role={isCritical ? 'alert' : 'status'} aria-live={isCritical ? 'assertive' : 'polite'}>
```
Y en store: `navigator.vibrate?.([100, 50, 100])` para error.

---

## 🟡 Hallazgos Menores / Mejora Continua (Severidad: Baja)

### 16. Number Inputs Sin Stepper Touch-Friendly
**Archivos:** `DepositTab.tsx:63-74`, `TransferTab.tsx:185-197`, `WithdrawTab.tsx` (similar)  
**Recomendación:** Componente `NumberStepper` con botones `+/-` grandes (44px) + input central.

### 17. Textareas Sin Auto-Resize
**Archivos:** `Profile/[id]/page.tsx:395-400`, `news/[id]/page.tsx:280-286`, `Support/page.tsx:179-192`  
**Recomendación:** Hook `useAutoResizeTextarea`.

### 18. SearchBar Sin Botón Limpiar (Clear) en Mobile
**Archivo:** `SearchBar.tsx` — útil cuando usuario escribe y quiere borrar rápido sin backspace múltiple.  
**Recomendación:** Mostrar `X` cuando `value.length > 0` en mobile.

### 19. Hover Effects Sin Equivalente Touch (`hover:-translate-y`)
**Archivos:** `ArtifactCard.tsx:30`, `BookCard.tsx` (similar), `QuickNav.tsx:27`, `GlassCard` variants  
**Recomendación:** Añadir `active:scale-[0.98]` o `active:-translate-y-0.5` junto a `hover:`.

### 20. PostCard Action Row Puede Quedar Estrecho (<360px)
**Archivo:** `PostCard.tsx:142-188` — 4 botones (like, comment, repost, share) en `flex gap-6`.  
**Recomendación:** En mobile `md:hidden`, usar `flex-wrap` o bottom sheet de acciones.

### 21. Sidebar Mobile Drawer Sin Backdrop Blur
**Archivo:** `Sidebar.tsx:94` — `bg-black/50` sin `backdrop-blur`.  
**Recomendación:** `bg-black/50 backdrop-blur-md`.

### 22. Modal `max-h-[90vh]` Problemático en iOS Safari (Toolbar Collapse)
**Archivo:** `Modal.tsx:107` — `90vh` no considera toolbar dinámico.  
**Recomendación:** `max-h-[calc(100dvh-4rem)]` o `min-h-[700px] max-h-[90dvh]`.

### 23. Falta Skip-to-Content Link para Accesibilidad
**Archivo:** `app/layout.tsx` — no hay `<a href="#main" className="sr-only focus:not-sr-only">Saltar al contenido</a>`.  
**Recomendación:** Añadir en `RootLayout` antes de `children`.

### 24. Debounce en SearchBar Pero No en Otros Inputs (ej. TransferTab query)
**Archivo:** `TransferTab.tsx:35-58` — usa `useRef` + `setTimeout` manual, no `useDebounce` hook.  
**Recomendación:** Usar `useDebounce` consistente.

### 25. Bundle Analyzer / Size Budget No Configurado
**Archivo:** `package.json` / `next.config.js` — no hay `@next/bundle-analyzer` ni `webpack-bundle-analyzer` en CI.  
**Recomendación:** Añadir script `analyze` y budget en CI.

### 26. Imágenes `next/image` Sin `sizes` / `priority` en Heroes
**Archivos:** `HeroCarousel.tsx:50-56`, `ArticleDetailPage.tsx:200-206`, `FeaturedArticle.tsx`  
**Recomendación:** Hero images: `priority`, `sizes="100vw"`. Grid: `sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"`.

### 27. No Offline Cache / SWR Persistence
**Archivo:** `queryClient.ts` — TanStack Query default, sin `persistQueryClient` a localStorage.  
**Recomendación:** `persistQueryClient({ client: queryClient, persister: localStoragePersister })`.

### 28. Falta Documentación Mobile Patterns para Contributors
**Recomendación:** Crear `docs/MOBILE_PATTERNS.md` con:
- Touch target sizes
- Safe-area usage
- Modal vs BottomSheet decision tree
- Gesture implementation guide
- Testing checklist

### 29. CI Lint Rule Para Touch Targets
**Recomendación:** Regla ESLint custom o `tailwindcss` plugin que advierta si `w-10 h-10` (40px) en botones interactivos sin `min-h-[44px] min-w-[44px]`.

### 30. `ZerineDisplay` / Diamond Icon Sin `aria-label` Explícito en Algunos Usos
**Archivos:** `TopBar.tsx:151-159`, `Treasury/CrystalHero.tsx:20-23` — icono decorativo pero cantidad es texto, OK. Verificar que todos los `ZerineDisplay` tengan `aria-hidden="true"` en icono.

---

## 📋 Roadmap de Implementación Priorizado

### Sprint 1 — Fundaciones PWA & Push (2 semanas) ✅ **COMPLETADO**
- [x] `public/manifest.json` + icons (192, 512, maskable)
- [x] Service Worker básico (cache shell + API network-first)
- [x] Web Push VAPID keys + backend endpoint `/api/push/subscribe`
- [x] Prompt de instalación PWA (en TopBar user menu + banner)
- [x] Push permission request en login/onboarding (auto-subscribe on login)

### Sprint 2 — Gestos Nativos Core (2 semanas) ✅ COMPLETADO
- [x] `useSwipeable` hook + integración en `HeroCarousel`, `QuickNav`, `TabGroup`
- [x] `PullToRefresh` wrapper para feeds (Profile, News, Notifications, Marketplace)
- [x] `SwipeActionRow` para listas (Notifications, AllFriends, PostCard mobile)
- [x] `LongPressContextMenu` para PostCard (edit/delete), ArtifactCard, PetCard
- [x] Pinch-to-zoom en `Lightbox` + swipe-to-dismiss

### Sprint 3 — Formularios Mobile-First (1 semana) ✅ COMPLETADO
- [x] `inputMode`, `autocomplete`, `enterKeyHint` en todos los inputs
- [x] `NumberStepper` component para depósitos/transferencias
- [x] `useAutoResizeTextarea` hook
- [x] SearchBar clear button (mobile)
- [x] Reemplazar `window.confirm()` en `useUnsavedChangesGuard` por `ConfirmDialog`

### Sprint 4 — Accesibilidad & Polish (1 semana)
- [ ] `@media (prefers-reduced-motion)` en `globals.css`
- [ ] `aria-pressed` en filter chips
- [ ] Skip-to-content link
- [ ] Avatar alt text fix
- [ ] Focus-visible audit en todos los componentes interactivos
- [ ] Modal iOS toolbar fix (`max-h-[calc(100dvh-4rem)]`)
- [ ] Sidebar backdrop blur

### Sprint 5 — Performance & Platform (1.5 semanas)
- [ ] Bundle analyzer + size budget CI
- [ ] `next/image` `sizes` + `priority` en heroes
- [ ] Prefetch on `touchStart` para links críticos
- [ ] SWR persistence (localStorage)
- [ ] Web Share API en artículos/posts (`navigator.share()`)
- [ ] Vibration en toastError + haptic en acciones críticas

### Sprint 6 — BottomSheet & Advanced (1 semana)
- [ ] `BottomSheet` component reutilizable
- [ ] Refactor `CartSidebar` → BottomSheet en mobile
- [ ] Refactor `EditProfileModal` / `AllFriendsModal` → `Modal` + `BottomSheet` variant
- [ ] Swipe-to-dismiss en modales/lightbox

---

## 📎 Apéndice: Checklist Mobile para Code Reviews

> **Usar en cada PR que toque UI.** Marcar ✅/❌/N/A.

### Layout & Safe Area
- [ ] `pb-safe` o `env(safe-area-inset-bottom)` en elementos fixed bottom
- [ ] `pt-[var(--topbar-h)]` / `pb-[var(--bottomnav-h)]` en contenedores full-height
- [ ] `viewportFit: "cover"` en metadata (solo root layout)
- [ ] BottomNav solo `<md`, Sidebar solo `lg+`

### Touch Targets
- [ ] Botones interactivos ≥44×44px (`min-h-[44px] min-w-[44px]`)
- [ ] Icon buttons: `w-11 h-11` (44px) o `p-3` con `min-h-[44px]`
- [ ] Links en listas: `py-3` mínimo
- [ ] FAB: `w-16 h-16` (64px) ✅

### Gestos
- [ ] Carousels: swipe horizontal (`useSwipeable`)
- [ ] Listas pull-to-refresh: `PullToRefresh` wrapper
- [ ] Items con acciones: `SwipeActionRow` o long-press menu
- [ ] Modales/lightbox: swipe-to-dismiss (down/right)
- [ ] Imágenes zoom: pinch-to-zoom

### Formularios
- [ ] `inputMode` correcto (numeric, email, text, search)
- [ ] `autocomplete` correcto (email, current-password, new-password, off)
- [ ] `enterKeyHint` correcto (next, done, send, search, go)
- [ ] `autoCapitalize="none"` en email/user
- [ ] Number steppers touch-friendly para cantidades
- [ ] Textareas auto-resize
- [ ] SearchBar: clear button visible cuando hay texto

### Feedback
- [ ] No `window.confirm()` / `window.alert()` / `window.prompt()`
- [ ] Toasts: `aria-live="polite"` (info), `"assertive"` (error)
- [ ] Vibración en errores críticos (`navigator.vibrate?.([100,50,100])`)
- [ ] Haptic en acciones importantes (like, send, delete confirm)
- [ ] Loading states en botones (`aria-busy`, spinner)

### Accesibilidad
- [ ] `prefers-reduced-motion`: animaciones desactivadas
- [ ] Focus-visible en todos los interactivos (`focus-visible:ring-2`)
- [ ] `aria-pressed` en toggle buttons / filter chips
- [ ] `role="button"` + `aria-label` en divs clickables
- [ ] Skip-to-content link en root layout
- [ ] Avatar `alt` descriptivo
- [ ] Modales: focus trap, Escape handler, `aria-labelledby`

### Imágenes & Performance
- [ ] Hero images: `priority` + `sizes="100vw"`
- [ ] Grid images: `sizes` responsive
- [ ] `loading="lazy"` en below-the-fold
- [ ] Bundle size <150KB gzipped initial (mobile 3G)
- [ ] Code-splitting: `dynamic()` import para modales pesados
- [ ] SWR persistence configurado

### PWA & Platform
- [ ] Manifest.json válido + icons
- [ ] Service Worker registrado
- [ ] Push permission request flow
- [ ] Web Share API donde aplica (artículos, posts, perfil)
- [ ] Install prompt UX

### Testing
- [ ] Probado en iOS Safari (notch, toolbar collapse, safe-area)
- [ ] Probado en Android Chrome (back gesture, bottom nav)
- [ ] Probado con teclado virtual abierto (visualViewport)
- [ ] Probado con `prefers-reduced-motion: reduce`
- [ ] Probado con screen reader (VoiceOver / TalkBack)

---

## 📁 Archivos Clave Referenciados

| Archivo | Líneas Relevantes | Nota |
|---------|-------------------|------|
| `app/layout.tsx` | 34-41, 63-68 | Viewport, metadata, providers |
| `app/globals.css` | 115-138, 339-341, 353-449 | Layout vars, safe-area, animaciones |
| `components/layout/AppShell.tsx` | 24-30 | Main padding con CSS vars |
| `components/layout/BottomNav.tsx` | 25-26 | `md:hidden fixed bottom-0 pb-safe` |
| `components/layout/Sidebar.tsx` | 93-101 | Mobile drawer |
| `components/layout/TopBar.tsx` | 79-85, 172-181 | Notification polling, wallet |
| `components/ui/Modal.tsx` | 95-131 | Portal, focus trap, scroll lock |
| `components/ui/ToastViewport.tsx` | 35-37 | Posición adaptativa |
| `components/ui/FAB.tsx` | 12-13 | `bottom-20` |
| `components/ui/ConfirmDialog.tsx` | 67-121 | Reemplazar `window.confirm()` |
| `components/ui/SearchBar.tsx` | 60-65 | Debounce integrado |
| `components/ui/AdminCrudTable.tsx` | 88-116 | Mobile cards vs desktop table |
| `components/domain/Profile/ProfileHeader.tsx` | 120-121 | Acciones full-width mobile |
| `components/domain/Dashboard/QuickNav.tsx` | 20-36 | Snap-x horizontal scroll |
| `hooks/useUnsavedChangesGuard.ts` | 46-47 | **Usa `window.confirm()`** |
| `hooks/useDebounce.ts` | 8-16 | Hook reutilizable |
| `hooks/useFileUpload.ts` | 41-48 | Image upload hook |
| `app/(main)/treasury/page.tsx` | 63-74, 185-197 | Number inputs sin `inputMode` |
| `app/(auth)/login/page.tsx` | 65-96 | Login form sin autocomplete |
| `app/(main)/profile/[id]/page.tsx` | 395-400 | Post composer textarea |
| `app/(main)/news/[id]/page.tsx` | 280-286 | Comment textarea |
| `app/(main)/support/page.tsx` | 179-192 | Report textarea + file upload |
| `components/domain/BorginBurkes/HeroCarousel.tsx` | 104-115, 200-213 | Auto-rotate pause, buttons |
| `components/ui/Lightbox.tsx` | 12-35 | Sin keyboard/gestos |
| `components/domain/BorginBurkes/CartSidebar.tsx` | 40-44 | Side drawer (debería bottom sheet) |

---
