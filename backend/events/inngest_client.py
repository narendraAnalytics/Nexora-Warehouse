import inngest

from config import settings

inngest_client = inngest.Inngest(
    app_id="nexora-backend",
    is_production=not settings.INNGEST_DEV,
    signing_key=settings.INNGEST_SIGNING_KEY or None,
)
