import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import Settings, get_settings
from app.openrouter import OpenRouter

CONTEXTE = {
    "type": "reponse_coproprietaire",
    "copropriete": {"nom": "Les Tilleuls", "adresse": "12 rue des Lilas", "code_postal": "69003", "ville": "Lyon"},
    "source_type": "demande",
    "source": {
        "titre": "Fuite plafond salle de bain",
        "categorie": "fuite",
        "statut": "en_cours",
        "description": "Fuite signalée par Mme Marie Dupont (06 12 34 56 78) depuis l'appartement du dessus.",
    },
    "personnes": [{"nom": "Dupont", "prenom": "Marie", "telephone": "06 12 34 56 78", "email": "marie.dupont@exemple.fr"}],
    "destinataire": "Marie Dupont",
}


class FauxLLM:
    def __init__(self, reponse: str):
        self.recu: dict | None = None
        self.reponse = reponse

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.recu = json.loads(req.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": self.reponse}}]})


@pytest.fixture
def client():
    faux = FauxLLM(
        "Objet : Fuite au 12 rue des Lilas\n\nMadame [PERSONNE_1],\n\nNous accusons réception de votre signalement. "
        "Nous vous joindrons au [TELEPHONE_1].\n\nLa gestionnaire"
    )
    s = Settings(openrouter_api_key="cle", openrouter_url="https://openrouter.test/v1/chat", model_redaction="modele/test")
    main.app.dependency_overrides[get_settings] = lambda: s
    main.app.dependency_overrides[main.get_llm] = lambda: OpenRouter(s, httpx.AsyncClient(transport=httpx.MockTransport(faux)))
    yield TestClient(main.app), faux
    main.app.dependency_overrides.clear()


def test_pseudonymise_avant_envoi_et_restaure_apres(client):
    c, faux = client
    r = c.post("/redaction", json=CONTEXTE)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["objet"] == "Fuite au 12 rue des Lilas"
    assert "Madame Marie Dupont" in b["corps"]
    assert "06 12 34 56 78" in b["corps"]

    envoye = json.dumps(faux.recu, ensure_ascii=False)
    for donnee_perso in ("Dupont", "Marie", "06 12 34 56 78", "marie.dupont"):
        assert donnee_perso not in envoye
    assert "Les Tilleuls" in envoye
    assert faux.recu["provider"] == {"data_collection": "deny"}
    assert faux.recu["model"] == "modele/test"


def test_type_inconnu_refuse(client):
    c, _ = client
    assert c.post("/redaction", json={**CONTEXTE, "type": "lettre_anonyme"}).status_code == 422


def test_sans_cle_openrouter():
    s = Settings(openrouter_api_key="")
    main.app.dependency_overrides[get_settings] = lambda: s
    try:
        r = TestClient(main.app).post("/redaction", json=CONTEXTE)
        assert r.status_code == 502
    finally:
        main.app.dependency_overrides.clear()


def test_modele_choisi_par_l_administration(client):
    c, faux = client
    assert c.post("/redaction", json={**CONTEXTE, "modele": "mistralai/mistral-large"}).status_code == 200
    assert faux.recu["model"] == "mistralai/mistral-large"
