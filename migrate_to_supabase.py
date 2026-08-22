"""Migrate Neon PostgreSQL → Supabase PostgreSQL.

Since both are PostgreSQL, this is a simple pg_dump → psql migration.
No data conversion needed — it's PostgreSQL to PostgreSQL.

Usage:
  1. Create a Supabase project at https://supabase.com
  2. Get the connection string from Settings > Database > URI (Transaction mode)
  3. Set SUPABASE_DB_URL below or in backend/.env
  4. Run: python migrate_to_supabase.py

Requirements:
  - Neon compute must be available (not suspended)
  - pg_dump and psql must be installed
"""
import subprocess
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv("backend/.env")

NEON_URL = os.environ.get("NEON_DATABASE_URL", "")
SUPABASE_URL = os.environ.get("SUPABASE_DB_URL", "")
PG_DUMP = r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
PSQL = r"C:\Program Files\PostgreSQL\18\bin\psql.exe"
DUMP_FILE = "neon_dump_full.sql"


def test_connection(url, name):
    print(f"Testing {name} connection...")
    result = subprocess.run(
        [PSQL, "-d", url, "-c", "SELECT 1"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  FAILED: {result.stderr.strip()[:200]}")
        return False
    print(f"  OK")
    return True


def pg_dump():
    print(f"\nDumping Neon to {DUMP_FILE}...")
    result = subprocess.run(
        [PG_DUMP, "-d", NEON_URL, "--no-owner", "--no-acl", "-f", DUMP_FILE],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"pg_dump FAILED: {result.stderr}")
        return False
    size = os.path.getsize(DUMP_FILE)
    print(f"  Dump complete: {size:,} bytes")
    return True


def psql_import():
    print(f"\nImporting to Supabase...")
    result = subprocess.run(
        [PSQL, "-d", SUPABASE_URL, "-f", DUMP_FILE],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  Output: {result.stdout[-500:]}")
        print(f"  Errors: {result.stderr[-500:]}")
        return False
    print(f"  Import complete!")
    return True


def verify():
    print(f"\nVerifying Supabase database...")
    result = subprocess.run(
        [PSQL, "-d", SUPABASE_URL, "-c",
         "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public'"],
        capture_output=True, text=True
    )
    print(f"  {result.stdout.strip()}")

    result = subprocess.run(
        [PSQL, "-d", SUPABASE_URL, "-c",
         "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 20"],
        capture_output=True, text=True
    )
    print(f"\nTop tables:\n{result.stdout}")


def main():
    if not NEON_URL:
        print("ERROR: NEON_DATABASE_URL not set.")
        print("Set it in backend/.env or as environment variable.")
        sys.exit(1)

    if not SUPABASE_URL:
        print("ERROR: SUPABASE_DB_URL not set.")
        print("Get it from: Supabase Dashboard > Settings > Database > URI (Transaction mode)")
        print("Set it in backend/.env or as environment variable.")
        sys.exit(1)

    # Test Neon
    if not test_connection(NEON_URL, "Neon"):
        print("\nNeon compute is suspended. Wait for billing cycle reset.")
        sys.exit(1)

    # Test Supabase
    if not test_connection(SUPABASE_URL, "Supabase"):
        print("\nSupabase connection failed. Check your SUPABASE_DB_URL.")
        sys.exit(1)

    # Dump
    if not pg_dump():
        sys.exit(1)

    # Import
    if not psql_import():
        print("\nImport had errors. Check output above.")
        sys.exit(1)

    # Verify
    verify()

    print("\n" + "="*50)
    print("Migration Neon → Supabase complete!")
    print(f"\nUpdate backend/.env with:")
    print(f"  DATABASE_URL={SUPABASE_URL}")
    print(f"\nThen restart your backend.")


if __name__ == "__main__":
    main()
