# Hogwarts Nexus Lumiere — Agent Guidelines

## Regla #1: Todo debe funcionar

No crear elementos UI sin comportamiento real. Cada boton, enlace, input y componente interactivo debe tener su logica implementada. Si no se puede implementar la funcionalidad completa (porque depende de un endpoint que no existe), crear la funcionalidad minima viable:

- Botones que navegan → usar `Link` o `router.push`
- Botones que togglean estado → usar `useState`
- Botones que eliminan/modifican → conectar con API o模拟 comportamiento con estado local
- Inputs → deben actualizar estado y validarse
- NUNCA crear un boton o elemento visual que no haga nada al presionarlo

## Regla #2: Validar antes de enviar

Toda operacion financiera o destructiva debe validarse antes de ejecutarse:

- Transferencias/retiros: verificar saldo suficiente, deshabilitar boton si no alcanza
- Crear/eliminar: confirmar campos obligatorios
- Formularios: mostrar errores inline, no silenciarlos

## Regla #3: Navegacion funcional

Cada elemento interactivo debe ejecutar su accion correspondiente:

- Botones que navegan → deben llevar a la vista relevante
- Listas de items clickeables → cada item debe llevar a su detalle
- Al interactuar con un elemento con estado (leido/no leido, activo/inactivo) → actualizar dicho estado
- Botones generales como "Ver todas", "Ver mas", etc. → deben ejecutar su accion, no ser decorativos

## Regla #4: Iconos de Material Symbols

Usar solo nombres validos de Material Symbols Outlined. Nombres comunes que NO existen:

- `cage` → usar `pets`
- `language` → usar `translate`
- `emoji_emotion` → usar `mood`
- `classified` → usar `sell`

Verificar iconos en: https://fonts.google.com/icons

## Regla #5: Fondo circular en botones de icono

Todo boton que contiene solo un icono debe tener fondo circular:

```
className="w-10 h-10 inline-flex items-center justify-center rounded-full ..."
```

Nunca usar solo `p-2 rounded-full` sin dimensiones fjas — el icono puede no generar un cuadrado perfecto.

## Regla #6: No duplicar codigo sin razon

- Los componentes UI (Button, GlassCard, Avatar, Badge, etc.) ya existen en `components/ui/`
- No redefinir `MaterialIcon` en cada pagina — crear una version compartida o importar
- Seguir los patrones existentes del proyecto

## Regla #7: Backend primero

Antes de agregar campos nuevos al frontend (como `attachment_url`):

1. Agregar la columna al modelo SQLAlchemy en `backend/app/models/`
2. Agregar el campo al schema Pydantic en `backend/app/schemas/`
3. Generar migracion Alembic: `cd backend && alembic revision --autogenerate -m "descripcion"`
4. Revisar el SQL generado en `alembic/versions/` antes de aplicar
5. Aplicar migracion: `alembic upgrade head`
6. Reiniciar el backend
7. Recien ahi actualizar el frontend

**NUNCA usar `create_all()` ni borrar `nexus.db` para cambios de esquema. Todo cambio debe ir por Alembic.**

## Regla #11: Verificacion de backend

Despues de cada cambio en modelos o migraciones, ejecutar:

```bash
cd backend && ruff check .
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
```

## Regla #8: Lint y build

Despues de cada cambio, ejecutar:

```bash
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
```

No entregar codigo con errores de lint o tipos.

## Regla #9: Responsive

- Sidebar visible solo en `xl` (1280px+)
- BottomNav visible solo por debajo de `md` (768px)
- En mobile, las vistas de 3 paneles (messages) deben colapsar a 1 panel con navegacion

## Regla #10: Estilo visual

- Usar colores del design system Lumiere: primary `#0e3b60`, secondary `#775a19`, surface `#fcf9f8`
- Borgin & Burkes usa tema oscuro: inverse-surface `#313030` + gold
- Glassmorphism: usar clase `glass-card`
- Fuentes: EB Garamond (display), Hanken Grotesk (body), JetBrains Mono (labels)

## Regla #12: Límite de tamaño de archivo y modularización obligatoria

**NUNCA permitir que un archivo supere las 500 líneas.** Si un archivo alcanza ~400 líneas, planificar su refactor inmediato.

### Límites duros:
- **Backend (Python):** 500 líneas máx por archivo
- **Frontend (TypeScript/TSX):** 500 líneas máx por archivo
- **Archivos de configuración/schema:** 300 líneas máx

### Cuando un archivo crece demasiado:
1. **Identificar responsabilidades** — ¿Qué hace este archivo? (ej: router + service + schemas + helpers)
2. **Extraer a servicios** — Lógica de negocio → `backend/app/services/<domain>/`
3. **Dividir routers** — Un router por recurso/feature → `backend/app/routers/<feature>/<subrouter>.py`
4. **Extraer hooks/componentes** — Lógica de UI → `hooks/use<Feature>.ts`, `components/<Feature>/.tsx`
5. **Mover helpers compartidos** → `deps.py` (backend) o `utils/` (frontend)
6. **Dataclasses/schemas compartidos** → `schemas/` o `models/`

### Patrones obligatorios:
- **Router delgado:** Solo validación, auth, llamando a métodos de servicio
- **Servicio único responsabilidad:** Un servicio = un dominio (ej: `session_manager.py`, `event_service.py`)
- **Hook por feature:** `useMessages.ts`, `useConversations.ts`, `useE2EEncryption.ts`
- **Componente por responsabilidad visual:** `ConversationList.tsx`, `ChatPanel.tsx`, `MessageBubble.tsx`

### Verificación automática (CI):
```bash
# Backend
find backend/app -name "*.py" -exec wc -l {} + | awk '$1 > 500 {print "ERROR: " $2 " tiene " $1 " líneas"}'

# Frontend
find frontend/app -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1 > 500 {print "ERROR: " $2 " tiene " $1 " líneas"}'
```

**Si el CI falla por tamaño de archivo → bloquear merge hasta modularizar.**

---

## Auto-Update Flow (Android APK + PWA)

### Objetivo
Actualización estilo WhatsApp: push a main → CI builda APK firmado → usuarios con versión vieja reciben notificación y actualizan con un click.

### Arquitectura

```
┌─────────────┐     Push a main      ┌──────────────────┐
│  Developer  │ ──────────────────►  │ GitHub Actions   │
└─────────────┘                      │ .github/workflows│
                                     │ build-android-   │
                                     │ apk.yml          │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ 1. Build frontend│
                                     │ 2. Bump version  │
                                     │    (patch/minor/ │
                                     │     major via    │
                                     │     workflow_    │
                                     │     dispatch)    │
                                     │ 3. Sign APK      │
                                     │    (keystore     │
                                     │     from secrets)│
                                     │ 4. Upload artifact│
                                     │ 5. Create GH     │
                                     │    Release       │
                                     │ 6. POST webhook  │
                                     │    to backend    │
                                     └────────┬─────────┘
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ Backend          │
                                     │ version_info.json│
                                     │ /api/app/version │
                                     │ /api/app/apk     │
                                     └────────┬─────────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
               ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
               │ Android App   │     │ Web PWA       │     │ iOS PWA       │
               │ (Capacitor)   │     │ (ServiceWorkr)│     │ (Add to Home) │
               └───────┬───────┘     └───────┬───────┘     └───────┬───────┘
                       │                     │                     │
                       ▼                     ▼                     ▼
               useAppVersion.ts       useServiceWorker    useAppVersion.ts
               (polling 1h)           (updatefound)       (polling 1h)
                       │                     │                     │
                       ▼                     ▼                     ▼
               SWUpdateNotifier       SWUpdateNotifier    SWUpdateNotifier
               (toast + APK           (toast + reload)    (toast + reload)
               download)
```

### Componentes Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `.github/workflows/build-android-apk.yml` | CI: build, sign, version bump, release, webhook |
| `backend/app/routers/version.py` | `GET /api/app/version` + `POST /api/app/version` (webhook) |
| `backend/app/routers/apk.py` | `GET /api/app/apk` (descarga APK firmado, auth required) |
| `frontend/hooks/usePWA.ts` | `useAppVersion()` (polling + version compare) + `useServiceWorker()` (SW updates) |
| `frontend/components/ui/SWUpdateNotifier.tsx` | Toast unificado: APK download (Android) / SW reload (Web/iOS) |
| `frontend/components/ui/APKInstallBanner.tsx` | Banner "Instalar App" solo Android Web, usuarios logueados |

### Versionado

- **SemVer**: `MAJOR.MINOR.PATCH` (ej: `1.0.1`)
- **Android versionCode**: `MAJOR*10000 + MINOR*100 + PATCH` (ej: `10001`)
- Bump controlado por `workflow_dispatch.inputs.version_bump` (default: `patch`)

### Backend Version Info (`version_info.json`)

```json
{
  "current": "1.0.0",
  "latest": "1.0.1",
  "version_code": 10001,
  "apk_download_url": "/api/app/apk",
  "release_notes": "Bug fixes y mejoras de rendimiento",
  "force_update": false,
  "min_supported_version": "0.1.0"
}
```

### Flujo Usuario

1. **Push a main** → CI builda APK `1.0.1` → actualiza `version_info.json` via webhook
2. **Usuario abre app** (v1.0.0) → `useAppVersion` poll cada 1h detecta `latest != current`
3. **Toast aparece**: "Actualización 1.0.1 disponible. Toca para instalar."
4. **Click en toast**:
   - Android Capacitor → `window.location.href = /api/app/apk` → descarga APK → instalador nativo
   - Web PWA / iOS → `window.location.reload()` → SW aplica update
5. **App reinicia** en v1.0.1

### Force Update & Min Supported

- `force_update: true` → toast persistente, bloquea uso hasta actualizar
- `min_supported_version` → versiones abajo son incompatibles, fuerza update

### Configuración Requerida (Secrets)

| Secret | Descripción |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Keystore codificado en base64 (`base64 -w0 release.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | Store password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |
| `BACKEND_DEPLOY_WEBHOOK` | (Opcional) URL para notificar al backend del nuevo release |

### Comandos Útiles

```bash
# Version bump manual
gh workflow run build-android-apk.yml -f version_bump=minor

# Ver APK generado localmente
cd frontend && npx capacitor build android
# APK en: android/app/build/outputs/apk/release/app-release.apk

# Backend: actualizar versión manualmente
curl -X POST https://api.tudominio.com/api/app/version \
  -H "Content-Type: application/json" \
  -d '{"version":"1.0.2","version_code":10002,"release_notes":"Hotfix login"}'
```

