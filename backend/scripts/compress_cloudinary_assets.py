"""Reemplaza los originales pesados de Cloudinary por versiones WebP comprimidas.

Estrategia "solo queda la version comprimida":
  1. Backup JSON de todas las imagenes y sus referencias en la DB.
  2. Descarga cada imagen referenciada > COMPRESS_THRESHOLD, la re-encodea a
     WebP (1600px max, quality 80) con el MISMO pipeline de subida y la
     sobre-escribe en Cloudinary con la misma public_id (overwrite+invalidate).
  3. Actualiza las URLs en la DB con el secure_url fresco devuelto por
     Cloudinary (version y extension correctas, SIN transformaciones:
     las imagenes se sirven tal cual estan almacenadas).
  4. Con --delete-orphans, elimina las imagenes de Cloudinary que no estan
     referenciadas en la DB (basura sin uso, previa impresion del listado).

Uso (desde backend/, con DATABASE_URL de produccion en el entorno):

    python scripts/compress_cloudinary_assets.py                    # dry-run
    python scripts/compress_cloudinary_assets.py --apply            # aplica 2+3
    python scripts/compress_cloudinary_assets.py --apply --delete-orphans

Reversible solo via el backup generado en la carpeta backups/.
"""

import asyncio
import base64
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect as sa_inspect  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import engine  # noqa: E402

COMPRESS_THRESHOLD = 1 * 1024 * 1024  # solo re-comprimir por encima de 1MB
MAX_DIMENSION = 1600
WEBP_QUALITY = 80

_KEYWORDS = ("url", "image", "avatar", "attachment", "thumbnail", "screenshot", "cover")
_TRANSFORM_RE = re.compile(r"/image/upload/(?:f_auto,q_auto,w_2000/|f_auto,q_auto,w_2000)")

BACKUP_DIR = Path(__file__).resolve().parents[1] / "backups"


def _cloudinary_credentials() -> dict:
    env = {}
    for line in open(Path(__file__).resolve().parents[1] / ".env"):
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
        env.setdefault(key, os.getenv(key, ""))
    if not all(env.get(k) for k in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")):
        sys.exit("Faltan credenciales de Cloudinary en backend/.env")
    return env


def _cloudinary_list(creds: dict) -> list[dict]:
    auth = base64.b64encode(f"{creds['CLOUDINARY_API_KEY']}:{creds['CLOUDINARY_API_SECRET']}".encode()).decode()
    resources, cursor = [], None
    while True:
        url = f"https://api.cloudinary.com/v1_1/{creds['CLOUDINARY_CLOUD_NAME']}/resources/image?max_results=500"
        if cursor:
            url += "&next_cursor=" + urllib.parse.quote(cursor)
        req = urllib.request.Request(url, headers={"Authorization": "Basic " + auth})
        data = json.load(urllib.request.urlopen(req))
        resources.extend(data.get("resources", []))
        cursor = data.get("next_cursor")
        if not cursor:
            break
    return resources


def _strip_transform(url: str) -> str:
    return _TRANSFORM_RE.sub("/image/upload/", url)


def _to_webp(content: bytes) -> bytes | None:
    from PIL import Image
    import io

    try:
        img = Image.open(io.BytesIO(content))
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
        if img.mode not in ("RGB", "RGBA"):
            has_alpha = img.mode in ("LA", "PA") or (
                img.mode == "P" and "transparency" in img.info
            )
            img = img.convert("RGBA" if has_alpha else "RGB")
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
        return buf.getvalue()
    except Exception:
        return None


async def _db_urls() -> list[tuple[str, str, str]]:
    """(tabla, columna, url) de todas las URLs Cloudinary referenciadas."""
    found = []
    async with engine.connect() as conn:
        tables = await conn.run_sync(lambda sc: sa_inspect(sc).get_table_names())
        for table in tables:
            pk = (
                await conn.run_sync(lambda sc, t=table: sa_inspect(sc).get_pk_constraint(t))
            ).get("constrained_columns") or []
            if not pk:
                continue
            id_col = pk[0]
            columns = await conn.run_sync(lambda sc, t=table: sa_inspect(sc).get_columns(t))
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
                            f'WHERE "{name}" LIKE \'%res.cloudinary.com%\' AND "{name}" NOT LIKE \'%fallback%\''
                        )
                    )
                ).fetchall()
                for rid, raw in rows:
                    if raw and "res.cloudinary.com" in raw:
                        found.append((table, name, id_col, rid, raw))
    return found


def main() -> int:
    return asyncio.run(_main())


async def _main() -> int:
    apply = "--apply" in sys.argv
    delete_orphans = "--delete-orphans" in sys.argv

    creds = _cloudinary_credentials()
    cloud = creds["CLOUDINARY_CLOUD_NAME"]

    all_assets = {r["public_id"]: r for r in _cloudinary_list(creds)}
    print(f"Imagenes en Cloudinary: {len(all_assets)}")

    rows = await _db_urls()
    db_public_ids: dict[str, list[tuple[str, str, str]]] = {}
    for table, col, id_col, rid, raw in rows:
        plain = _strip_transform(raw)
        m = re.search(r"/image/upload/(?:v\d+/)?(.+)$", plain)
        if not m:
            continue
        pid = re.sub(r"\.[A-Za-z0-9]+$", "", m.group(1))
        db_public_ids.setdefault(pid, []).append((table, col, id_col, rid, raw))

    referenced = set(db_public_ids.keys())
    orphans = [pid for pid in all_assets if pid not in referenced]
    print(f"Referenciadas en DB: {len(referenced)} | Huerfanas: {len(orphans)}")

    # Backup
    BACKUP_DIR.mkdir(exist_ok=True)
    backup_path = BACKUP_DIR / f"cloudinary_backup_{datetime.now():%Y%m%d_%H%M%S}.json"
    backup = {
        "assets": all_assets,
        "db_rows": rows,
    }
    backup_path.write_text(json.dumps(backup, indent=1), encoding="utf-8")
    print(f"Backup: {backup_path}")

    if not apply:
        print("\nDRY-RUN: no se escribe nada. Con --apply se re-comprimen y se actualiza la DB.")
        for pid in sorted(orphans):
            print(f"  [HUERFANA] {pid} ({all_assets[pid]['bytes'] // 1024} KB)")
        return 0

    import cloudinary
    import cloudinary.api
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=creds["CLOUDINARY_CLOUD_NAME"],
        api_key=creds["CLOUDINARY_API_KEY"],
        api_secret=creds["CLOUDINARY_API_SECRET"],
        secure=True,
    )

    replacement_urls: dict[str, str] = {}  # pid -> nuevo secure_url
    recompressed = skipped = failed = 0

    for pid in sorted(referenced):
        asset = all_assets.get(pid)
        if not asset:
            continue
        size = asset.get("bytes", 0)
        fmt = asset.get("format", "")
        fetch_url = asset["url"].replace("http://", "https://")

        if size < COMPRESS_THRESHOLD or fmt in ("gif", "svg", "avif", "webp"):
            # Ya liviana o no raster/animada: solo limpiar la URL en DB.
            replacement_urls[pid] = _strip_transform(fetch_url)
            skipped += 1
            continue

        try:
            with urllib.request.urlopen(fetch_url, timeout=120) as resp:
                original = resp.read()
        except Exception as e:
            print(f"  [FALLO descarga] {pid}: {e}")
            failed += 1
            continue

        webp = _to_webp(original)
        if webp is None or len(webp) >= len(original):
            replacement_urls[pid] = _strip_transform(fetch_url)
            skipped += 1
            print(f"  [SIN GANANCIA] {pid} {size // 1024}KB -> {len(webp or b'') // 1024}KB")
            continue

        try:
            result = cloudinary.uploader.upload(
                webp,
                public_id=pid,
                resource_type="image",
                overwrite=True,
                invalidate=True,
            )
            new_url = result.get("secure_url")
            if not new_url:
                raise RuntimeError("secure_url vacio")
            replacement_urls[pid] = new_url
            recompressed += 1
            print(f"  [OK] {pid} {size // 1024}KB -> {len(webp) // 1024}KB ({recompressed} re-comprimidas)")
        except Exception as e:
            print(f"  [FALLO re-upload] {pid}: {e}")
            failed += 1

    # Actualizar DB con las URLs finales (nuevo secure_url o URL limpia).
    async def update_db():
        updated = 0
        async with engine.begin() as conn:
            for pid, refs in db_public_ids.items():
                final_url = replacement_urls.get(pid)
                if not final_url:
                    continue
                for table, col, id_col, rid, raw in refs:
                    await conn.execute(
                        text(
                            f'UPDATE "{table}" SET "{col}" = :nv '
                            f'WHERE "{id_col}" = :rid'
                        ),
                        {"nv": final_url, "rid": rid},
                    )
                    updated += 1
        return updated

    db_updated = await update_db()
    print(f"\nRe-comprimidas: {recompressed} | Saltadas (livianas/especiales): {skipped} | Fallos: {failed} | URLs DB actualizadas: {db_updated}")

    if delete_orphans and orphans:
        print(f"\nEliminando {len(orphans)} huerfanas...")
        batch = [orphans[i : i + 100] for i in range(0, len(orphans), 100)]
        for chunk in batch:
            cloudinary.api.delete_resources(chunk, resource_type="image")
        print("Huerfanas eliminadas.")
    elif orphans:
        print(f"\n{len(orphans)} huerfanas NO eliminadas (usa --delete-orphans).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
