"""Limpieza unica de datos en produccion.

Borra TODAS las filas de la base de datos EXCEPTO las de ``users``,
``feature_flags`` y ``alembic_version`` (historial de migraciones).

Es un script de un solo uso, no corre en cada deploy. Se ejecuta a mano
desde el backend (por ejemplo en la Shell de Render):

    cd backend
    python scripts/clean_production_data.py          # pide confirmacion
    python scripts/clean_production_data.py --yes    # sin confirmacion

El orden de borrado respeta las foreign keys (hijos antes que padres) y
todo se ejecuta dentro de una transaccion: si algo falla, no se borra nada.
"""

import argparse
import asyncio
import sys
from collections import deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect, text  # noqa: E402

from app.database import engine  # noqa: E402

PRESERVE_TABLES = {"users", "feature_flags", "alembic_version"}


def _delete_order(tables: list[str], fk_map: dict[str, set[str]]) -> list[str]:
    """Orden topologico: los que tienen FK (hijos) se borran antes que sus padres."""
    in_degree = {t: 0 for t in tables}
    children = {t: [] for t in tables}
    for t in tables:
        for ref in fk_map.get(t, set()):
            if ref == t or ref not in tables:
                continue
            in_degree[ref] += 1
            children[ref].append(t)
    queue = deque(t for t in tables if in_degree[t] == 0)
    order: list[str] = []
    while queue:
        t = queue.popleft()
        order.append(t)
        for child in children[t]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)
    leftover = [t for t in tables if in_degree[t] > 0]
    return order + leftover


def _collect(sync_conn):
    inspector = inspect(sync_conn)
    tables = set(inspector.get_table_names())
    fk_map: dict[str, set[str]] = {}
    for t in tables:
        fk_map[t] = {fk["referred_table"] for fk in inspector.get_foreign_keys(t)}
    return tables, fk_map


async def main(yes: bool) -> int:
    async with engine.connect() as conn:
        all_tables, fk_map = await conn.run_sync(_collect)

    to_delete = sorted(t for t in all_tables if t not in PRESERVE_TABLES)
    preserved = sorted(t for t in all_tables if t in PRESERVE_TABLES)
    order = _delete_order(to_delete, fk_map)

    print("=== LIMPIEZA UNICA DE DATOS EN PRODUCCION ===")
    print(f"Se conservan ({len(preserved)}): {', '.join(preserved)}")
    print(f"Se vacian ({len(order)}): {', '.join(order)}")

    if not yes:
        answer = input('Escribe "BORRAR" para confirmar: ').strip()
        if answer != "BORRAR":
            print("Abortado, no se borro nada.")
            return 1

    async with engine.begin() as conn:
        for t in order:
            result = await conn.execute(text(f'DELETE FROM "{t}"'))
            count = result.rowcount if result.rowcount is not None else 0
            print(f"  - {t}: {count} filas eliminadas")

    print("Limpieza completada.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Borra todos los datos excepto users/feature_flags/alembic_version.")
    parser.add_argument("--yes", "-y", action="store_true", help="omitir la confirmacion interactiva")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.yes)))
