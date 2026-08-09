import os
import psutil
import uvicorn

import ws_tls_bridge


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

    # The backend serves plain HTTP (Next's REST proxy talks to it over http).
    # But the dev frontend is HTTPS, so the browser needs a *secure* WebSocket.
    # A small WSS->WS bridge terminates TLS on :8443 with the frontend's mkcert
    # certs and forwards to this backend's ws:// endpoint. The browser connects
    # to wss://localhost:8443/messages/ws. Runs as a daemon thread; no-op if the
    # certs / `websockets` are missing (e.g. prod, where TLS is handled upstream).
    _here = os.path.dirname(os.path.abspath(__file__))
    _cert = os.path.abspath(os.getenv("SSL_CERTFILE") or os.path.join(_here, "..", "frontend", "certs", "nexus-dev.pem"))
    _key = os.path.abspath(os.getenv("SSL_KEYFILE") or os.path.join(_here, "..", "frontend", "certs", "nexus-dev-key.pem"))
    ws_tls_bridge.start_in_thread(_cert, _key)

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
