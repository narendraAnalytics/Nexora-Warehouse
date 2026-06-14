from langchain_groq import ChatGroq

from config import settings


def get_llms() -> tuple[ChatGroq, ChatGroq]:
    """
    Returns (llm_pro, llm_flash). Model names read from settings (env-configurable).

    llm_pro   — CEO, Finance, Procurement, Demand Forecast, Knowledge agents
    llm_flash — Inventory, Communication agents
    """
    llm_pro = ChatGroq(
        model=settings.GROQ_MODEL_PRO,
        api_key=settings.GROQ_API_KEY,
        temperature=0,
    )
    llm_flash = ChatGroq(
        model=settings.GROQ_MODEL_FLASH,
        api_key=settings.GROQ_API_KEY,
        temperature=0,
    )
    return llm_pro, llm_flash


def get_llm_pro() -> ChatGroq:
    """CEO, Finance, Procurement, Demand Forecast, Knowledge agents."""
    return ChatGroq(model=settings.GROQ_MODEL_PRO, api_key=settings.GROQ_API_KEY, temperature=0)


def get_llm_flash() -> ChatGroq:
    """Inventory, Communication agents."""
    return ChatGroq(model=settings.GROQ_MODEL_FLASH, api_key=settings.GROQ_API_KEY, temperature=0)
