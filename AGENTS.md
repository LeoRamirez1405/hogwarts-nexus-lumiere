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

