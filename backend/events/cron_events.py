"""
Nexora cron event handlers — scheduled jobs:
  Daily 8:00 AM — CEO Morning Briefing generation + email delivery
"""
import inngest
from langchain_core.messages import HumanMessage

from config import Settings
from events.inngest_client import inngest_client


def create_cron_functions(pool, agent_graphs: dict, settings: Settings) -> list:
    """Return list of Inngest Function objects for scheduled cron jobs."""

    @inngest_client.create_function(
        fn_id="ceo-morning-briefing",
        trigger=inngest.TriggerCron("0 8 * * *"),
        retries=1,
    )
    async def ceo_morning_briefing(ctx: inngest.Context, step: inngest.Step) -> dict:
        """Daily 8:00 AM IST — generate CEO executive briefing and email it."""

        async def generate_briefing():
            graph = agent_graphs.get("ceo")
            if not graph:
                return "ceo agent not available"
            result = await graph.ainvoke({
                "messages": [HumanMessage(
                    content=(
                        "Generate the daily morning executive briefing for Nexora. "
                        "Cover all branches. Include revenue, risks, operations pulse, "
                        "stockout alerts, and top 3 recommended actions for today."
                    )
                )],
                "briefing_type": "morning_briefing",
                "warehouse_id": None,
            })
            return result["messages"][-1].content

        briefing_text = await step.run("generate-briefing", generate_briefing)

        async def send_briefing_email():
            graph = agent_graphs.get("communication")
            if not graph:
                return "communication agent not available"
            email_task = (
                f"Send an executive report email to {settings.CEO_EMAIL} with "
                f"subject 'Nexora Morning Briefing — Daily Executive Summary' "
                f"and the following report content:\n\n{briefing_text}"
            )
            result = await graph.ainvoke({
                "messages": [HumanMessage(content=email_task)],
            })
            return result["messages"][-1].content

        email_output = await step.run("send-briefing-email", send_briefing_email)

        return {
            "event": "cron/morning-briefing",
            "briefing_preview": briefing_text[:400],
            "email_status": email_output[:200],
        }

    return [ceo_morning_briefing]
