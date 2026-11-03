from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    # Un modèle par tâche — à choisir sur https://openrouter.ai/models
    model_redaction: str = "anthropic/claude-sonnet-4.5"
    model_chat: str = "anthropic/claude-sonnet-4.5"
    model_extraction: str = "google/gemini-2.5-flash"
    # Refuse les fournisseurs qui conservent ou exploitent les données
    openrouter_data_collection: str = "deny"
    llm_timeout_s: float = 120.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
