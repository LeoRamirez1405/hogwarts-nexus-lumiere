"""Shared helpers for threaded comments.

Builds reply trees out of flat comment lists for posts, articles and forum
threads. Each comment table mirrors the same shape (``id``, ``parent_id``),
so one function serves all three routers.
"""

from typing import Any, Callable, List


def nest_comments(comments: List[Any], response_factory: Callable[[Any], Any]) -> List[Any]:
    """Turn a flat, chronological comment list into a reply tree.

    ``response_factory`` receives each ORM comment and returns its response
    object (already carrying the ``author``). Replies are appended in
    ``replies`` on their parent; orphans (missing parent) become roots.
    """
    flat = {c.id: response_factory(c) for c in comments}
    roots: List[Any] = []
    for c in comments:
        resp = flat[c.id]
        parent_id = getattr(resp, "parent_id", None)
        if parent_id and parent_id in flat:
            flat[parent_id].replies.append(resp)
        else:
            roots.append(resp)
    return roots
