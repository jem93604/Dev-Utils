"""Tiny in-memory sliding-window rate limiter (no extra deps).

Per-key (IP + endpoint) request timestamps. Suitable for single-process
dev/self-host. Behind multiple workers use proxy-level limiting instead.
"""
import time
from collections import defaultdict, deque

_hits: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(key: str, limit: int, window_s: int = 60) -> bool:
    """Return True if allowed (and record hit), False if over limit."""
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(now)
    return True


def clear_rate_limits() -> None:
    _hits.clear()
