from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException

from .config import Settings, get_settings
from .openrouter import LLMError, OpenRouter
from .pocketbase import PBError, PocketBase
from .redaction import Brouillon, DemandeRedaction, rediger

# Servi derrière Caddy sous /ia (uvicorn --root-path /ia)
app = FastAPI(title="Gestion copro — worker IA")

_http = httpx.AsyncClient(timeout=30)


def get_llm(s: Annotated[Settings, Depends(get_settings)]) -> OpenRouter:
    return OpenRouter(s)


async def get_pb(
    s: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> PocketBase:
    """Chaque appel porte le jeton PocketBase de l'utilisatrice."""
    if not authorization:
        raise HTTPException(401, "Authentification requise")
    pb = PocketBase(s.pb_url, authorization, _http)
    try:
        await pb.verifier_session()
    except PBError:
        raise HTTPException(401, "Session invalide")
    return pb


@app.get("/health")
async def health(s: Annotated[Settings, Depends(get_settings)]) -> dict:
    return {"ok": True, "llm_configure": bool(s.openrouter_api_key)}


@app.post("/redaction", response_model=Brouillon)
async def redaction(
    d: DemandeRedaction,
    pb: Annotated[PocketBase, Depends(get_pb)],
    llm: Annotated[OpenRouter, Depends(get_llm)],
    s: Annotated[Settings, Depends(get_settings)],
) -> Brouillon:
    try:
        return await rediger(pb, llm, s.model_redaction, d)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except PBError as e:
        raise HTTPException(404 if e.status == 404 else 502, str(e))
    except LLMError as e:
        raise HTTPException(502, str(e))
