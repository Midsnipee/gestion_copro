import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import Settings, get_settings
from app.openrouter import OpenRouter

COPRO = "copro0000000001"
DEMANDE = "dema00000000001"
autre_copro = "copro0000000002"

RECORDS = {
    f"/api/collections/copropriete/records/{COPRO}": {
        "id": COPRO, "nom": "Les Tilleuls", "adresse": "12 rue des Lilas", "code_postal": "69003", "ville": "Lyon",
    },
    f"/api/collections/demande/records/{DEMANDE}": {
        "id": DEMANDE, "copropriete": COPRO, "titre": "Fuite plafond salle de bain",
        "categorie": "fuite", "statut": "en_cours",
        "description": "<p>Fuite signalée par Mme Marie Dupont (06 12 34 56 78) depuis l'appartement du dessus.</p>",
        "expand": {"demandeur": {"nom": "Dupont", "prenom": "Marie", "telephone": "06 12 34 56 78", "email": "marie.dupont@exemple.fr"}},
    },
}


class Faux:
    def __init__(self, reponse_llm: str):
        self.envoye_au_llm: dict | None = None
        self.reponse_llm = reponse_llm

    def __call__(self, req: httpx.Request) -> httpx.Response:
        if req.url.host == "openrouter.test":
            self.envoye_au_llm = json.loads(req.content)
            return httpx.Response(200, json={"choices": [{"message": {"content": self.reponse_llm}}]})
        if req.url.path.endswith("/auth-refresh"):
            if req.headers.get("authorization") != "jeton-valide":
                return httpx.Response(401)
            return httpx.Response(200, json={"record": {"id": "user00000000001"}})
        rec = RECORDS.get(req.url.path)
        return httpx.Response(200, json=rec) if rec else httpx.Response(404)


@pytest.fixture
def client(monkeypatch):
    faux = Faux(
        "Objet : Fuite au 12 rue des Lilas\n\nMadame [PERSONNE_1],\n\nNous accusons réception de votre signalement. "
        "Nous vous joindrons au [TELEPHONE_1].\n\nLa gestionnaire"
    )
    transport = httpx.MockTransport(faux)
    settings = Settings(pb_url="http://pb.test", openrouter_api_key="cle", openrouter_url="https://openrouter.test/v1/chat",
                        model_redaction="modele/test")
    monkeypatch.setattr(main, "_http", httpx.AsyncClient(transport=transport))
    main.app.dependency_overrides[get_settings] = lambda: settings
    main.app.dependency_overrides[main.get_llm] = lambda: OpenRouter(settings, httpx.AsyncClient(transport=transport))
    yield TestClient(main.app), faux
    main.app.dependency_overrides.clear()


def test_redaction_pseudonymise_et_restaure(client):
    c, faux = client
    r = c.post("/redaction", headers={"Authorization": "jeton-valide"},
               json={"type": "reponse_coproprietaire", "copropriete_id": COPRO,
                     "source_type": "demande", "source_id": DEMANDE, "destinataire": "Marie Dupont"})
    assert r.status_code == 200, r.text
    corps = r.json()
    assert corps["objet"] == "Fuite au 12 rue des Lilas"
    assert "Madame Marie Dupont" in corps["corps"]
    assert "06 12 34 56 78" in corps["corps"]

    envoye = json.dumps(faux.envoye_au_llm, ensure_ascii=False)
    for donnee_perso in ("Dupont", "Marie", "06 12 34 56 78", "marie.dupont"):
        assert donnee_perso not in envoye
    assert "Les Tilleuls" in envoye  # le contexte de l'immeuble, lui, est transmis
    assert faux.envoye_au_llm["provider"] == {"data_collection": "deny"}
    assert faux.envoye_au_llm["model"] == "modele/test"


def test_refuse_sans_session(client):
    c, _ = client
    r = c.post("/redaction", headers={"Authorization": "faux"}, json={"type": "relance", "copropriete_id": COPRO})
    assert r.status_code == 401


def test_refuse_une_source_d_une_autre_copro(client, monkeypatch):
    c, _ = client
    monkeypatch.setitem(RECORDS, f"/api/collections/demande/records/{DEMANDE}",
                        {**RECORDS[f"/api/collections/demande/records/{DEMANDE}"], "copropriete": autre_copro})
    r = c.post("/redaction", headers={"Authorization": "jeton-valide"},
               json={"type": "relance", "copropriete_id": COPRO, "source_type": "demande", "source_id": DEMANDE})
    assert r.status_code == 400


def test_valide_les_identifiants(client):
    c, _ = client
    r = c.post("/redaction", headers={"Authorization": "jeton-valide"},
               json={"type": "relance", "copropriete_id": "x' || 1=1"})
    assert r.status_code == 422
