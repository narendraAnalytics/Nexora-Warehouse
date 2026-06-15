from events.inngest_client import inngest_client
from events.domain_events import create_domain_functions
from events.cron_events import create_cron_functions

from config import Settings
from memory.redis_manager import RedisMemoryManager


def create_inngest_functions(
    pool,
    agent_graphs: dict,
    memory: RedisMemoryManager,
    settings: Settings,
) -> list:
    """Return all Inngest functions: 5 domain event handlers + 1 cron."""
    domain_fns = create_domain_functions(pool, agent_graphs, memory)
    cron_fns = create_cron_functions(pool, agent_graphs, settings)
    return domain_fns + cron_fns


__all__ = ["inngest_client", "create_inngest_functions"]
