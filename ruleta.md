# Ruleta de la Fortuna Mágica — Premios y plan de extensión

Documento vivo del sistema de premios de la ruleta (`/album/ruleta`). Los
segmentos se guardan como JSON en `RouletteConfig.segments`:

```json
{"prize": "pack:1", "label": "1 Sobre", "weight": 30, "pack_type_id": null}
```

- `prize`: tipo + cantidad, separados por `:`.
- `label`: texto visible (rueda, resultado e historial).
- `weight`: peso relativo para el giro ponderado.
- `pack_type_id`: opcional, solo aplica a `pack`.

## Tipos de premio

| `prize` | Descripción | Estado |
|---|---|---|
| `pack:N` | N sobres (el sobre lo define `pack_type_id` o el más barato) | Implementado |
| `zerines:N` | N Zerines (depósito + transacción) | Implementado |
| `legendary` | 1 sobre con legendaria garantizada | Implementado |
| `none` | Nada: "buen intento". Filler para dar valor al jackpot | Implementado |
| `xp:N` | N puntos de XP. No se almacena: `_batch_xp` lo re-deriva contando `RouletteSpin.result_json` | Implementado |
| `spins:N` | N giros gratis para futuros giros (`users.free_spins`). El giro consume un giro gratis antes de cobrar 💎 | Implementado |
| `petitem:<id>` | 1 ítem de la Sala de los Menesteres (requiere insert en `user_pet_items`) | En backlog |
| `card:<rareza>` | Carta aleatoria *no repetida* de esa rareza — rompe la regla "solo sobres dan cartas"; solo como jackpot rarísimo | En backlog |
| `discount` / `pity_boost` | Descuento en próxima compra / boost de pity — requieren estado por usuario | En backlog |

## Reglas de negocio

- Giro gratis primero: si `users.free_spins > 0` se consume uno y el giro
  cuesta 0 (el historial registra `cost = 0`). Si no, se cobran Zerines.
- Un `prize` desconocido lanza `ValueError` **antes** de cobrar — nunca cobrar
  y no dar nada en silencio.
- El cobro de un giro pago crea una `Transaction` tipo `purchase`, que ya
  otorga 5 XP (`buy_product` en `magic_level.py`). Los premios `xp:N` se suman
  encima.
- Giro bloqueado si: no hay álbum activo, el usuario ya completó el álbum, o
  no alcanza el costo (y no tiene giros gratis).
- Números malformados (`xp:abc`, `spins:-3`) caen a 0/1 con `_parse_int`
  (validación defensiva, Regla #2).

## Puntos de extensión (hardcodeados)

1. `backend/app/services/roulette_service.py` → `KNOWN_PRIZE_KINDS` + cadena
   `if/elif` en `spin()`.
2. `frontend/app/(main)/admin/albums/ConsolidatedAdminPage.tsx` →
   `SEGMENT_KIND_LABEL`, `DEFAULT_SEGMENT` y los campos condicionales por tipo.
3. `frontend/components/album/RouletteWheel.tsx` → líneas opcionales del
   resultado (el `label` ya se muestra genérico).
4. `backend/app/schemas/roulette.py` → campos de `SpinResponse`.

## Plan incremental

### Paso 1 — Base (implementado)
- `none`: rama explícita sin premio en `spin()`.
- `xp:N`: premio registrado en `result_json`; `_batch_xp` en
  `magic_level.py` lo suma a los niveles (misma consulta en batch que el resto).
- `spins:N`: columna `users.free_spins` (migración `8fdabb64fb5a`), consumo
  prioritario en `spin()`, `free_spins_won` en la respuesta.
- `SpinResponse` extendido: `xp_won`, `free_spins_won`.
- Tests: `test_roulette_none_prize_charges_and_gives_nothing`,
  `test_roulette_xp_prize_counts_in_batch_xp`,
  `test_roulette_spins_prize_grants_free_spins`,
  `test_roulette_free_spin_consumed_before_zerines`,
  `test_roulette_unknown_prize_rejected_without_charge`.
- Editor admin: opciones "Nada (buen intento)", "XP" y "Giro gratis" con sus
  campos de cantidad. Fix de bug preexistente: al editar una config guardada
  el select ahora reconoce el tipo (`kindOf`) en vez de quedar en blanco.
- Jugador: resultado muestra `+N XP` y `+N giro(s) gratis`; el botón "Girar"
  queda habilitado con giros gratis aunque no alcance el saldo; aviso de giros
  gratis disponibles.

### Paso 2 — Ítem de la Sala de los Menesteres (backlog)
1. Leer `backend/app/models/pet_item.py` y `user_pet_item.py` para saber cómo
   insertar un ítem (cantidades, columnas).
2. `prize: petitem:<id>` → insert en `UserPetItem` al ganar + transacción o
   log para auditoría.
3. Editor admin: select de ítems disponibles + campo de cantidad.
4. Resultado del jugador: línea "Ítem: <nombre>".

### Paso 3 — Carta directa (backlog, requiere decisión de diseño)
1. Definir si se da una carta **faltante** (nunca duplicado) de rareza R.
2. `spin()`: query de cartas faltantes; si no quedan, re-roll o cae a
   `zerines:0`.
3. Decidir el peso sugerido (jackpot ~1-2%).
4. Editor admin: select de rareza.

### Paso 4 — Estado por usuario (backlog)
- `discount:N` (descuento % en la siguiente compra de sobre): columna en
  `users` o tabla de ventajas + consumo en `buy_pack`.
- `pity_boost:N` (acercar el contador de pity): depende de dónde vive el pity
  en `pack_service` (hay progreso por usuario en `OpenPackResult`).

### Cómo verificar cada paso
```bash
cd backend && ruff check . && python -m pytest tests/ -q
cd frontend && npm run lint && npx tsc --noEmit
```