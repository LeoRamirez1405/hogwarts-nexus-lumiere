# Mobile Patterns — Hogwarts Nexus Lumiére

Guía de patrones mobile para contribuciones. Aplicar en cada PR que toque UI.

## Touch Targets

- Botones interactivos: `min-h-[44px] min-w-[44px]` o `w-11 h-11`.
- Icon buttons solos: `w-10 h-10` mínimo con `inline-flex items-center justify-center rounded-full`.
- Links en listas: `py-3` mínimo.
- FAB: `w-16 h-16` (64px).

## Safe Area

- Elementos fixed bottom: `pb-safe` o `env(safe-area-inset-bottom)`.
- Contenedores full-height: `pt-[var(--topbar-h)]` / `pb-[var(--bottomnav-h)]`.
- `viewportFit: "cover"` solo en root layout (`app/layout.tsx`).
- BottomNav solo `<md`, Sidebar solo `lg+` (ver `BottomNav.tsx`, `Sidebar.tsx`).

## Modal vs BottomSheet

| Caso | Componente |
|------|-----------|
| Diálogo centrado, contenido corto | `Modal` (`components/ui/Modal.tsx`) |
| Panel que se desliza desde abajo (iOS nativo) | `BottomSheet` (`components/ui/BottomSheet.tsx`) |
| Confirmación | `ConfirmDialog` — NUNCA `window.confirm()` |
| Imagen ampliada | `Lightbox` (pinch-zoom + swipe-to-dismiss + Escape) |

Regla: en mobile, cualquier drawer lateral (ej. carrito) debe ser `BottomSheet`.

## Gestos

| Gesto | Utilidad | Uso |
|-------|----------|-----|
| Swipe horizontal/vertical | `useSwipeable` (`hooks/useGestures.ts`) | Carousels, TabGroup, Lightbox, BottomSheet |
| Pull-to-refresh | `PullToRefresh` (`components/gestures/PullToRefresh.tsx`) | Feeds (Profile, News, Notifications, Marketplace) |
| Swipe actions en listas | `SwipeActionRow` | Notifications, amigos, posts |
| Long-press menu | `LongPressContextMenu` | PostCard, cards |
| Pinch-to-zoom | `usePinchZoom` | Lightbox |

## Formularios

- `inputMode` correcto: `numeric`, `email`, `search`, `text`.
- `autoComplete`: `email`, `current-password`, `new-password`, `off`.
- `enterKeyHint`: `next`, `done`, `send`, `search`, `go`.
- `autoCapitalize="none"` en email/usuario.
- Cantidades: `NumberStepper` (botones ± 44px+).
- Textareas: `useAutoResizeTextarea`.
- SearchBar: botón clear visible cuando hay texto (ya integrado).

## Feedback

- Toasts: `toastInfo/toastSuccess/toastError` de `lib/toastStore.ts`.
- Vibración: `navigator.vibrate` — patrones en `lib/haptics.ts`
  (`hapticLight`, `hapticMedium`, `hapticHeavy`, `hapticSuccess`, `hapticError`).
- Errores críticos: `toastError` ya vibra `[100, 50, 100]`.
- Acciones importantes (like, send, delete): llamar `hapticLight()` en el handler.
- Nunca `window.confirm/alert/prompt`.

## Accesibilidad

- `prefers-reduced-motion`: animaciones desactivadas en `globals.css`.
- `focus-visible:ring-2` en interactivos.
- `aria-pressed` en filter chips / toggles.
- Skip-to-content: ya en `app/layout.tsx` (link a `#main-content`).
- Avatar `alt` descriptivo.
- Modales: focus trap + Escape + `aria-labelledby` (en `Modal`, `BottomSheet`, `Lightbox`).

## Imágenes & Performance

- Hero images: `priority` + `sizes="(max-width: 768px) 100vw, 50vw"`.
- Grid images: `sizes` responsive; `loading="lazy"` below-the-fold.
- Bundle: budget en `next.config.ts` (200KB JS / 50KB CSS), `npm run analyze`.
- Code-splitting: `dynamic()` para modales pesados.
- SWR persistence: `lib/queryClient.ts` + `QueryProvider` (localStorage, 24h).

## PWA & Platform

- Manifest generado en `app/manifest.ts`.
- Service Worker: `public/sw.js` (registrado en `app/layout.tsx`).
- Push: `components/pwa/PushSubscriptionButton.tsx` + backend `/api/push/subscribe`.
- Web Share API: `navigator.share()` con fallback a `clipboard` (artículos, posts).
- Prefetch: `usePrefetchOnTouch` en links críticos (BottomNav, TopBar, Sidebar, QuickNav).

## Testing Checklist (cada PR de UI)

- [ ] iOS Safari (notch, toolbar collapse, safe-area)
- [ ] Android Chrome (back gesture, bottom nav)
- [ ] Teclado virtual abierto (visualViewport)
- [ ] `prefers-reduced-motion: reduce`
- [ ] Screen reader (VoiceOver / TalkBack)
