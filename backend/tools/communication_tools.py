"""
Communication tools — async @tool functions that send emails via Resend API.
Settings injected via closure. All tools build clean HTML from plain-text input.
"""
import json
from datetime import datetime

import resend
from langchain_core.tools import tool

from config import Settings


def create_communication_tools(settings: Settings) -> list:
    """Return the 3 communication tools with Resend config captured in closure."""

    resend.api_key = settings.RESEND_API_KEY
    from_address = f"{settings.RESEND_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>"

    def _html_wrap(title: str, badge: str, badge_color: str, body_html: str) -> str:
        return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f4f4f5; margin: 0; padding: 24px; }}
  .card {{ background: #fff; border-radius: 8px; padding: 32px; max-width: 600px;
           margin: 0 auto; border: 1px solid #e4e4e7; }}
  .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px;
            font-size: 12px; font-weight: 600; background: {badge_color};
            color: #fff; margin-bottom: 16px; }}
  h1 {{ font-size: 20px; color: #18181b; margin: 0 0 16px; }}
  .body {{ color: #3f3f46; font-size: 15px; line-height: 1.6; white-space: pre-wrap; }}
  .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #e4e4e7;
             font-size: 12px; color: #a1a1aa; }}
</style></head>
<body>
  <div class="card">
    <div class="badge">{badge}</div>
    <h1>{title}</h1>
    <div class="body">{body_html}</div>
    <div class="footer">
      Nexora Distribution Intelligence Platform &nbsp;·&nbsp;
      {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
    </div>
  </div>
</body>
</html>"""

    @tool
    async def send_alert_email(
        to_email: str,
        subject: str,
        alert_type: str,
        body_text: str,
    ) -> str:
        """Send an operational alert email via Resend.

        Use for time-sensitive operational issues:
        - Stockout alerts (product below reorder threshold)
        - Overdue order notifications
        - Supplier delay warnings
        - Inventory imbalance alerts

        Args:
            to_email: Recipient email address.
            subject: Email subject line (concise, action-oriented).
            alert_type: One of: STOCKOUT | OVERDUE_ORDER | SUPPLIER_DELAY | INVENTORY | OTHER
            body_text: Plain-text alert details. Be specific: include product, warehouse, quantities, impact.

        Returns JSON with status and Resend email id on success.
        """
        badge_colors = {
            "STOCKOUT": "#dc2626",
            "OVERDUE_ORDER": "#ea580c",
            "SUPPLIER_DELAY": "#d97706",
            "INVENTORY": "#2563eb",
            "OTHER": "#6d28d9",
        }
        color = badge_colors.get(alert_type.upper(), "#6d28d9")
        html = _html_wrap(subject, alert_type.upper(), color, body_text)
        try:
            response = resend.Emails.send({
                "from": from_address,
                "to": [to_email],
                "subject": f"[NEXORA ALERT] {subject}",
                "html": html,
            })
            return json.dumps({"status": "sent", "id": response.get("id"), "to": to_email})
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def send_escalation_email(
        to_email: str,
        issue_title: str,
        details: str,
        priority: str = "HIGH",
    ) -> str:
        """Send a manager escalation email via Resend requiring human action.

        Use when an issue exceeds agent authority and needs a manager decision:
        - Orders delayed ≥ 3 days or value > ₹50,000
        - Supplier replacement decisions
        - High-value purchase order approvals
        - Cross-warehouse transfer conflicts

        Args:
            to_email: Manager's email address.
            issue_title: Short title of the escalation issue.
            details: Full context — what happened, impact in INR, recommended action, deadline.
            priority: CRITICAL | HIGH | MEDIUM (default HIGH)

        Returns JSON with status and Resend email id on success.
        """
        priority_colors = {
            "CRITICAL": "#dc2626",
            "HIGH": "#ea580c",
            "MEDIUM": "#d97706",
        }
        color = priority_colors.get(priority.upper(), "#ea580c")
        subject = f"[{priority.upper()}] Escalation: {issue_title}"
        html = _html_wrap(subject, f"ESCALATION · {priority.upper()}", color, details)
        try:
            response = resend.Emails.send({
                "from": from_address,
                "to": [to_email],
                "subject": f"[NEXORA ESCALATION] {issue_title}",
                "html": html,
            })
            return json.dumps({"status": "sent", "id": response.get("id"), "to": to_email, "priority": priority})
        except Exception as e:
            return json.dumps({"error": str(e)})

    @tool
    async def send_executive_report(
        to_email: str,
        report_title: str,
        report_content: str,
    ) -> str:
        """Send an executive report or CEO briefing email via Resend.

        Use for structured executive communications:
        - Daily morning briefing (revenue, risks, top actions)
        - Weekly profitability summary
        - Incident post-mortem reports
        - Strategic recommendation reports from CEO Agent

        Args:
            to_email: Executive recipient email address.
            report_title: Report title (e.g. "Daily Briefing — 15 Jun 2026").
            report_content: Full report in plain text. Use clear sections with headings.
                           Include INR figures, % changes, and specific recommendations.

        Returns JSON with status and Resend email id on success.
        """
        html = _html_wrap(report_title, "EXECUTIVE REPORT", "#0f172a", report_content)
        try:
            response = resend.Emails.send({
                "from": from_address,
                "to": [to_email],
                "subject": f"[NEXORA] {report_title}",
                "html": html,
            })
            return json.dumps({"status": "sent", "id": response.get("id"), "to": to_email})
        except Exception as e:
            return json.dumps({"error": str(e)})

    return [
        send_alert_email,
        send_escalation_email,
        send_executive_report,
    ]
