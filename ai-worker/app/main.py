"""Worker IA interne : appelé uniquement par l'API (non exposé par Caddy).
L'API vérifie la session et assemble le contexte ; le worker pseudonymise et appelle le modèle."""

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException

from .config import Settings, get_settings
from .openrouter import LLMError, OpenRouter
from .redaction import Brouillon, DemandeRedaction, rediger

app = FastAPI(title="Gestion copro — worker IA")


def get_llm(s: Annotated[Settings, Depends(get_settings)]) -> OpenRouter:
    return OpenRouter(s)


@app.get("/health")
async def health(s: Annotated[Settings, Depends(get_settings)]) -> dict:
    return {"ok": True, "llm_configure": bool(s.openrouter_api_key)}


@app.post("/redaction", response_model=Brouillon)
async def redaction(
    d: DemandeRedaction,
    llm: Annotated[OpenRouter, Depends(get_llm)],
    s: Annotated[Settings, Depends(get_settings)],
) -> Brouillon:
    try:
        return await rediger(llm, s.model_redaction, d)
    except LLMError as e:
        raise HTTPException(502, str(e))
