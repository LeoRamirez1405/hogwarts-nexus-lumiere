"""Tiny WSS -> WS bridge for local dev.

The dev frontend runs over HTTPS (`next --experimental-https`), so the browser
can only open a *secure* WebSocket (`wss://`). But:

  - The backend serves plain HTTP in dev (Next's REST proxy — a bundled
    `http-proxy` — refuses to talk to a self-signed HTTPS backend, so the
    backend must stay HTTP for REST to work).
  - Next's dev server does not forward WebSocket upgrades to browsers.

So we terminate TLS here on :8443 with the frontend's mkcert cert and forward
frames to the backend's plain-WS endpoint on :8000. The browser connects to
`wss://localhost:8443/messages/ws`; the subprotocol (auth token) is preserved.

Started automatically as a daemon thread by `run.py` in dev. No-op if the
`websockets` package or the certs are missing.
"""

import asyncio
import os
import ssl
import threading

BACKEND_HOST = os.getenv("WS_BRIDGE_BACKEND", "localhost:8000")
BRIDGE_PORT = int(os.getenv("WS_BRIDGE_PORT", "8443"))


async def _pipe(src, dst):
    try:
        async for message in src:
            await dst.send(message)
    except Exception:
        pass
    finally:
        try:
            await dst.close()
        except Exception:
            pass


async def _handler(client, websockets_mod):
    # Preserve the path (/messages/ws) and the offered subprotocols (the auth
    # token travels as Sec-WebSocket-Protocol) when dialing the backend.
    path = client.request.path
    offered = client.request.headers.get("Sec-WebSocket-Protocol")
    subs = [s.strip() for s in offered.split(",")] if offered else None
    upstream_url = f"ws://{BACKEND_HOST}{path}"
    try:
        upstream = await websockets_mod.connect(upstream_url, subprotocols=subs)
    except Exception:
        await client.close(code=1011, reason="bridge: upstream connect failed")
        return
    try:
        await asyncio.gather(_pipe(client, upstream), _pipe(upstream, client))
    finally:
        try:
            await upstream.close()
        except Exception:
            pass


async def _serve(cert, key):
    import websockets

    def _select(conn, subprotocols):
        # Echo the client's first offered subprotocol (the token) so the
        # browser's handshake is fully RFC-compliant.
        return subprotocols[0] if subprotocols else None

    ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_ctx.load_cert_chain(cert, key)

    async def handler(client):
        await _handler(client, websockets)

    async with websockets.serve(
        handler, "0.0.0.0", BRIDGE_PORT, ssl=ssl_ctx, select_subprotocol=_select
    ):
        print(f"[ws-bridge] wss://localhost:{BRIDGE_PORT} -> ws://{BACKEND_HOST}")
        await asyncio.Future()  # run forever


def start_in_thread(cert, key):
    """Launch the bridge in a daemon thread with its own event loop."""
    if not (os.path.exists(cert) and os.path.exists(key)):
        print("[ws-bridge] certs not found — bridge disabled")
        return
    try:
        import websockets  # noqa: F401
    except ImportError:
        print("[ws-bridge] `websockets` not installed — bridge disabled")
        return

    def _run():
        try:
            asyncio.run(_serve(cert, key))
        except Exception as exc:  # pragma: no cover
            print(f"[ws-bridge] stopped: {exc}")

    threading.Thread(target=_run, name="ws-tls-bridge", daemon=True).start()
