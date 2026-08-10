"""Reescribe las URLs de Cloudinary en la base para servir imagenes optimizadas.

Convierte cada URL de subida del estilo

    https://res.cloudinary.com/<cloud>/image/upload/v1234/nexus_uploads/x.png

en

    https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_2000/v1234/nexus_uploads/x.png

La transformacion se aplica on-the-fly por el CDN (WebP/AVIF + calidad
automatica + ancho maximo) sin re-subir ni tocar los archivos originales.
Las URLs que ya tienen transformacion (contienen ``f_auto``) se ignoran.

Uso (desde backend/):

    set DATABASE_URL=<url-de-produccion>   # o export en bash
    python scripts/rewrite_cloudinary_urls.py              # dry-run (no escribe)
    python scripts/rewrite_cloudinary_urls.py --apply      # aplica los cambios

Corre sobre cualquier dialecto soportado (Postgres/Neon y SQLite local).
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect as sa_inspect  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402

TRANSFORM = "f_auto,q_auto,w_2000"

_CLD = re.compile(
    r"^(https?://res\.cloudinary\.com/[^/]+/image/upload/)(.*)$",
    re.IGNORECASE,
)

# Columnas candidatas: cualquier columna que referencie un archivo subido.
_KEYWORDS = ("url", "image", "avatar", "attachment", "thumbnail", "screenshot", "cover")


def transform_url(value: str) -> str | None:
    """Devuelve la URL con la transformacion, o None si no corresponde."""
    m = _CLD.match(value)
    if not m:
        return None
    rest = m.group(2)
    if not rest or rest.startswith("f_auto"):
        return None
    return f"{m.group(1)}{TRANSFORM}/{rest}"


async def main() -> int:
    apply = "--apply" in sys.argv
    changed = 0
    checked = 0

    async with engine.begin() as conn:

        def _scan(sync_conn):
            return sa_inspect(sync_conn)

        tables = await conn.run_sync(lambda sc: _scan(sc).get_table_names())

        for table in tables:
            pk = (
                await conn.run_sync(
                    lambda sc, t=table: _scan(sc).get_pk_constraint(t)
                )
            ).get("constrained_columns") or []
            if not pk:
                continue
            id_col = pk[0]
            columns = await conn.run_sync(
                lambda sc, t=table: _scan(sc).get_columns(t)
            )
            for col in columns:
                name = col["name"]
                if not any(k in name.lower() for k in _KEYWORDS):
                    continue
                try:
                    is_text = col["type"].python_type is str
                except Exception:
                    is_text = False
                if not is_text:
                    continue
                rows = (
                    await conn.execute(
                        text(
                            f'SELECT "{id_col}", "{name}" FROM "{table}" '
                            f'WHERE "{name}" LIKE \'%res.cloudinary.com%\''
                        )
                    )
                ).fetchall()
                for row_id, raw in rows:
                    if raw is None:
                        continue
                    checked += 1
                    new_value = transform_url(str(raw))
                    if new_value is None or new_value == str(raw):
                        continue
                    changed += 1
                    print(f"[{table}.{name}] {str(raw)[:100]} -> {new_value[:120]}")
                    if apply:
                        await conn.execute(
                            text(f'UPDATE "{table}" SET "{name}" = :nv WHERE "{id_col}" = :rid'),
                            {"nv": new_value, "rid": row_id},
                        )

    mode = "APLICADO" if apply else "DRY-RUN (nada escrito)"
    print(f"\n{mode}: {changed} URL(s) actualizadas de {checked} revisadas")
    return 0


if __name__ == "__main__":
    import asyncio

    raise SystemExit(asyncio.run(main()))
