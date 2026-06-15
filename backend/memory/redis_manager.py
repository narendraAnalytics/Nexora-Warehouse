"""
Nexora Redis Memory Manager — short-term agent memory layer.

Key namespaces:
  nexora:workflow:{id}   — active LangGraph workflow state (TTL 24h)
  nexora:approval:{id}   — pending HITL approval requests (TTL 7 days)
  nexora:alert:{id}      — agent-generated alerts (TTL 48h)
  nexora:session:{id}    — per-agent session context (TTL 1h)
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis

from config import settings

# TTLs in seconds
TTL_WORKFLOW  = 60 * 60 * 24        # 24 hours
TTL_APPROVAL  = 60 * 60 * 24 * 7   # 7 days
TTL_ALERT     = 60 * 60 * 48       # 48 hours
TTL_SESSION   = 60 * 60            # 1 hour


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RedisMemoryManager:
    def __init__(self, client: aioredis.Redis):
        self._r = client

    # ── Health ─────────────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        try:
            return await self._r.ping()
        except Exception:
            return False

    # ── Workflow State ──────────────────────────────────────────────────────────

    async def set_workflow(self, workflow_id: str, state: dict, ttl: int = TTL_WORKFLOW) -> None:
        key = f"nexora:workflow:{workflow_id}"
        await self._r.set(key, json.dumps(state), ex=ttl)

    async def get_workflow(self, workflow_id: str) -> dict | None:
        key = f"nexora:workflow:{workflow_id}"
        raw = await self._r.get(key)
        return json.loads(raw) if raw else None

    async def update_workflow(self, workflow_id: str, updates: dict) -> dict | None:
        existing = await self.get_workflow(workflow_id) or {}
        existing.update(updates)
        existing["updated_at"] = _now()
        await self.set_workflow(workflow_id, existing)
        return existing

    async def delete_workflow(self, workflow_id: str) -> None:
        await self._r.delete(f"nexora:workflow:{workflow_id}")

    # ── Pending Approvals (HITL gates) ─────────────────────────────────────────

    async def create_approval(self, approval_type: str, payload: dict, ttl: int = TTL_APPROVAL) -> str:
        approval_id = str(uuid.uuid4())
        key = f"nexora:approval:{approval_id}"
        record = {
            "approval_id": approval_id,
            "approval_type": approval_type,
            "status": "pending",
            "payload": payload,
            "created_at": _now(),
        }
        await self._r.set(key, json.dumps(record), ex=ttl)
        # track all pending approval IDs in a set
        await self._r.sadd("nexora:approvals:pending", approval_id)
        return approval_id

    async def get_approval(self, approval_id: str) -> dict | None:
        raw = await self._r.get(f"nexora:approval:{approval_id}")
        return json.loads(raw) if raw else None

    async def resolve_approval(self, approval_id: str, status: str, resolved_by: str = "system") -> dict | None:
        record = await self.get_approval(approval_id)
        if not record:
            return None
        record["status"] = status          # approved | rejected
        record["resolved_by"] = resolved_by
        record["resolved_at"] = _now()
        await self._r.set(f"nexora:approval:{approval_id}", json.dumps(record), ex=TTL_APPROVAL)
        await self._r.srem("nexora:approvals:pending", approval_id)
        return record

    async def list_pending_approvals(self) -> list[dict]:
        ids = await self._r.smembers("nexora:approvals:pending")
        results = []
        for aid in ids:
            record = await self.get_approval(aid)
            if record and record.get("status") == "pending":
                results.append(record)
        return sorted(results, key=lambda x: x.get("created_at", ""))

    # ── Alerts ──────────────────────────────────────────────────────────────────

    async def push_alert(self, agent_name: str, alert_type: str, message: str,
                         severity: str = "medium", metadata: dict | None = None) -> str:
        alert_id = str(uuid.uuid4())
        key = f"nexora:alert:{alert_id}"
        record = {
            "alert_id": alert_id,
            "agent_name": agent_name,
            "alert_type": alert_type,
            "message": message,
            "severity": severity,          # low | medium | high | critical
            "status": "unread",
            "metadata": metadata or {},
            "created_at": _now(),
        }
        await self._r.set(key, json.dumps(record), ex=TTL_ALERT)
        # keep a sorted set for retrieval by time (score = unix timestamp)
        import time
        await self._r.zadd("nexora:alerts:index", {alert_id: time.time()})
        return alert_id

    async def get_alerts(self, limit: int = 20, severity: str | None = None) -> list[dict]:
        # newest first
        ids = await self._r.zrevrange("nexora:alerts:index", 0, limit - 1)
        results = []
        for aid in ids:
            raw = await self._r.get(f"nexora:alert:{aid}")
            if raw:
                record = json.loads(raw)
                if severity is None or record.get("severity") == severity:
                    results.append(record)
        return results

    async def mark_alert_read(self, alert_id: str) -> None:
        raw = await self._r.get(f"nexora:alert:{alert_id}")
        if raw:
            record = json.loads(raw)
            record["status"] = "read"
            await self._r.set(f"nexora:alert:{alert_id}", json.dumps(record), keepttl=True)

    # ── Session Context ─────────────────────────────────────────────────────────

    async def set_session(self, session_id: str, data: dict, ttl: int = TTL_SESSION) -> None:
        await self._r.set(f"nexora:session:{session_id}", json.dumps(data), ex=ttl)

    async def get_session(self, session_id: str) -> dict | None:
        raw = await self._r.get(f"nexora:session:{session_id}")
        return json.loads(raw) if raw else None

    async def extend_session(self, session_id: str, ttl: int = TTL_SESSION) -> bool:
        return bool(await self._r.expire(f"nexora:session:{session_id}", ttl))

    async def delete_session(self, session_id: str) -> None:
        await self._r.delete(f"nexora:session:{session_id}")

    # ── Generic key/value (for agent-specific scratch state) ───────────────────

    async def set(self, key: str, value: Any, ttl: int = TTL_WORKFLOW) -> None:
        await self._r.set(f"nexora:{key}", json.dumps(value), ex=ttl)

    async def get(self, key: str) -> Any | None:
        raw = await self._r.get(f"nexora:{key}")
        return json.loads(raw) if raw else None

    async def delete(self, key: str) -> None:
        await self._r.delete(f"nexora:{key}")


# ── Factory ────────────────────────────────────────────────────────────────────

def create_redis_client() -> aioredis.Redis:
    # Render managed Redis and Upstash both require TLS on non-default ports
    use_ssl = settings.REDIS_PORT not in (6379,) or settings.REDIS_PASSWORD != ""
    return aioredis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        username=settings.REDIS_USERNAME,
        password=settings.REDIS_PASSWORD,
        decode_responses=True,
        ssl=use_ssl,
        ssl_cert_reqs="none",               # skip cert verification (Render/Upstash self-signed)
        socket_timeout=5,
        socket_connect_timeout=5,
    )


def create_memory_manager(client: aioredis.Redis) -> RedisMemoryManager:
    return RedisMemoryManager(client)
