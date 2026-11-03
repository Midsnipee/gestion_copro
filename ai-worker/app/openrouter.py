import httpx

from .config import Settings


class LLMError(RuntimeError):
    pass


class OpenRouter:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.s = settings
        self.client = client or httpx.AsyncClient(timeout=settings.llm_timeout_s)

    async def chat(self, model: str, messages: list[dict], temperature: float = 0.3) -> str:
        if not self.s.openrouter_api_key:
            raise LLMError("OPENROUTER_API_KEY non configurée")
        r = await self.client.post(
            self.s.openrouter_url,
            headers={
                "Authorization": f"Bearer {self.s.openrouter_api_key}",
                "X-Title": "Gestion copro",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "provider": {"data_collection": self.s.openrouter_data_collection},
            },
        )
        if r.status_code != 200:
            raise LLMError(f"OpenRouter {r.status_code}: {r.text[:300]}")
        data = r.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise LLMError(f"Réponse OpenRouter inattendue: {data}") from e
