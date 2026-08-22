"""Keep Supabase free tier alive — pings the database every 5 days.

Set up as a cron job or run manually. Supabase pauses free projects
after 1 week without API requests. This prevents that.

Usage:
  python keep_supabase_alive.py

Or add to Windows Task Scheduler / cron-job.org to run every 5 days.
"""
import subprocess
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv("backend/.env")

PSQL = r"C:\Program Files\PostgreSQL\17\bin\psql.exe"


def get_supabase_url():
    url = os.environ.get("SUPABASE_DB_URL", "")
    if not url:
        # Try reading from .env directly
        env_path = "backend/.env"
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("DATABASE_URL="):
                        url = line.split("=", 1)[1].strip()
                        if url.startswith("postgresql"):
                            return url
    return url if url.startswith("postgresql") else ""


def ping():
    url = get_supabase_url()
    if not url:
        print(f"[{datetime.now()}] No SUPABASE_DB_URL found. Skipping.")
        return False

    print(f"[{datetime.now()}] Pinging Supabase...")
    result = subprocess.run(
        [PSQL, "-d", url, "-c", "SELECT 1"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  OK — Supabase is alive")
        return True
    else:
        print(f"  FAILED: {result.stderr[:200]}")
        return False


if __name__ == "__main__":
    success = ping()
    sys.exit(0 if success else 1)
