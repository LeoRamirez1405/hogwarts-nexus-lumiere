import os
import signal
import psutil
import uvicorn


def kill_existing_processes():
    """Kill any existing uvicorn/Python processes running on port 8000."""
    current_pid = os.getpid()
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            if proc.pid == current_pid:
                continue
            cmdline = " ".join(proc.info.get("cmdline") or [])
            if ("uvicorn" in cmdline or "run.py" in cmdline) and "8000" in cmdline:
                print(f"Killing existing process {proc.pid}: {cmdline[:80]}")
                proc.terminate()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    # Wait a bit for processes to terminate
    import time
    time.sleep(0.5)


if __name__ == "__main__":
    kill_existing_processes()
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
