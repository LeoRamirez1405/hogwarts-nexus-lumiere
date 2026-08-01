"""Link preview (URL unfurling) endpoint.

Uses ``httpx`` to fetch the page and extract Open Graph / Twitter Card /
basic HTML meta tags. Runs with a short timeout and only allows
HTTPS/HTTP URLs to prevent SSRF.
"""

import re
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...schemas.message import LinkPreviewRequest, LinkPreviewResponse

router = APIRouter()

# Allowlist: only HTTP/HTTPS, no localhost/private IPs in production
_URL_REGEX = re.compile(r"^https?://", re.IGNORECASE)

# Timeouts: connect 3s, read 5s total
_TIMEOUT = httpx.Timeout(5.0, connect=3.0)

# User-Agent to avoid being blocked
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; NexusBot/1.0; +https://nexus.example)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _extract_meta(html: str, url: str) -> dict:
    """Very lightweight HTML meta extraction (no external deps).

    Looks for Open Graph (og:), Twitter Card (twitter:), and fallback
    standard <title> / <meta name="description">.
    """
    result = {"url": url, "title": None, "description": None, "image": None, "site_name": None}
    try:
        # Extract <title>
        title_match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
        if title_match:
            result["title"] = title_match.group(1).strip()

        # Open Graph
        og_title = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html, re.IGNORECASE)
        og_desc = re.search(r'<meta\s+property="og:description"\s+content="([^"]+)"', html, re.IGNORECASE)
        og_image = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html, re.IGNORECASE)
        og_site = re.search(r'<meta\s+property="og:site_name"\s+content="([^"]+)"', html, re.IGNORECASE)

        # Twitter Card
        tw_title = re.search(r'<meta\s+name="twitter:title"\s+content="([^"]+)"', html, re.IGNORECASE)
        tw_desc = re.search(r'<meta\s+name="twitter:description"\s+content="([^"]+)"', html, re.IGNORECASE)
        tw_image = re.search(r'<meta\s+name="twitter:image"\s+content="([^"]+)"', html, re.IGNORECASE)

        # Standard meta
        std_desc = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', html, re.IGNORECASE)

        result["title"] = (og_title or tw_title or title_match).group(1).strip() if (og_title or tw_title or title_match) else None
        result["description"] = (og_desc or tw_desc or std_desc).group(1).strip() if (og_desc or tw_desc or std_desc) else None
        result["image"] = (og_image or tw_image).group(1).strip() if (og_image or tw_image) else None
        result["site_name"] = og_site.group(1).strip() if og_site else None

        # Resolve relative image URLs
        if result["image"] and not _URL_REGEX.match(result["image"]):
            from urllib.parse import urljoin
            result["image"] = urljoin(url, result["image"])
    except Exception:
        # If anything goes wrong, return what we have
        pass
    return result


@router.post(
    "/messages/link-preview",
    response_model=LinkPreviewResponse,
    status_code=status.HTTP_200_OK,
)
async def get_link_preview(
    data: LinkPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch and return a link preview for the given URL."""
    url = data.url.strip()

    # Basic validation
    if not _URL_REGEX.match(url):
        raise HTTPException(status_code=400, detail="Only HTTP/HTTPS URLs are allowed")

    # Prevent SSRF: disallow localhost, private IPs in production
    # (httpx doesn't do this automatically)
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.hostname or ""
        # Block obvious internal hosts
        if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            raise HTTPException(status_code=400, detail="Internal URLs not allowed")
        # Block private IP ranges
        if host.startswith("10.") or host.startswith("192.168."):
            raise HTTPException(status_code=400, detail="Private IP ranges not allowed")
        if host.startswith("172.") and 16 <= int(host.split(".")[1]) <= 31:
            raise HTTPException(status_code=400, detail="Private IP ranges not allowed")
    except HTTPException:
        raise
    except Exception:
        pass  # If parsing fails, let httpx handle it

    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers=_HEADERS,
            limits=httpx.Limits(max_connections=5, max_keepalive_connections=2),
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timed out")
    except httpx.TooManyRedirects:
        raise HTTPException(status_code=400, detail="Too many redirects")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch URL")
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to fetch URL")

    meta = _extract_meta(html, url)
    return LinkPreviewResponse(**meta)