"""Core message operations: send, read, edit, delete, forward, pin and star.

This module now delegates to the ``core/`` sub-package.  Import router from
``core.router`` to preserve backwards compatibility.
"""

from .core.router import router  # noqa: F401