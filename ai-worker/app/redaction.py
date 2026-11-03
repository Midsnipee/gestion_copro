"""Rédaction automatique de courriers et rapports."""

import re
from typing import Literal

from pydantic import BaseModel

from .openrouter import OpenRouter
from .pseudonymisation import Pseudonymiseur

TypeDocument = Literal[
    "relance",
    "mise_en_demeure",
    "convocation",
    "demande_devis",
    "reponse_coproprietaire",
    "information",
    "rapport_visite",
    "compte_rendu_cs",
]

CONSIGNES_TYPE: dict[str, str] = {
    "relance": "Courrier de relance courtois mais ferme, qui rappelle la demande initiale et fixe un délai.",
    "mise_en_demeure": "Mise en demeure formelle : rappel des faits, obligation non respectée, délai impératif, conséquences. Ton juridique et sobre.",
    "convocation": "Convocation à une réunion ou assemblée : date, lieu, ordre du jour, modalités de pouvoir.",
    "demande_devis": "Demande de devis à une entreprise : description précise des travaux, adresse d'intervention, contraintes d'accès, délai de réponse souhaité.",
    "reponse_coproprietaire": "Réponse à un copropriétaire : accuser réception, répondre point par point, indiquer les prochaines étapes.",
    "information": "Note d'information aux copropriétaires, claire et concise.",
    "rapport_visite": "Rapport de visite d'immeuble structuré : constats par zone, points d'attention, actions à mener avec priorité.",
    "compte_rendu_cs": "Compte rendu de réunion du conseil syndical : présents, points abordés, décisions, actions et responsables.",
}

SYSTEM = """Tu es l'assistante de rédaction d'une gestionnaire de syndic de copropriété en France.
Tu rédiges en français, dans un registre professionnel et courtois, conforme aux usages des syndics.

Règles strictes :
- Les jetons entre crochets comme [PERSONNE_1], [EMAIL_2], [TELEPHONE_1] remplacent des données personnelles : recopie-les exactement, sans les modifier ni les expliquer.
- N'invente aucun fait, date, montant, nom ou référence. Si une information nécessaire manque, écris [À COMPLÉTER : description].
- Pas de formule de politesse de signature nominative : termine par « La gestionnaire » ; la signature est ajoutée ensuite.
- Réponds uniquement avec le document, au format :
Objet : <objet>

<corps du document>"""


class DemandeRedaction(BaseModel):
    """Contexte assemblé par l'API (droits déjà vérifiés)."""

    type: TypeDocument
    copropriete: dict
    source_type: Literal["demande", "visite", "reunion", "chantier"] | None = None
    source: dict | None = None
    personnes: list[dict] = []
    destinataire: str | None = None
    consignes: str = ""
    # Modèle choisi dans l'écran d'administration (sinon celui de la configuration)
    modele: str | None = None


class Brouillon(BaseModel):
    objet: str
    corps: str
    modele: str


def _texte(html: str | None) -> str:
    """Les champs « editor » de PocketBase sont en HTML."""
    if not html:
        return ""
    t = re.sub(r"<(br|/p|/li|/h\d)\s*/?>", "\n", html, flags=re.I)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def _declarer_personne(p: Pseudonymiseur, personne: dict | None) -> None:
    if not personne:
        return
    nom, prenom = personne.get("nom"), personne.get("prenom")
    if prenom and nom:
        p.ajouter(f"{prenom} {nom}")
        p.ajouter(f"{nom} {prenom}")
    p.ajouter(nom)
    p.ajouter(personne.get("adresse_postale"), "ADRESSE")
    p.ajouter(personne.get("email"), "EMAIL")
    p.ajouter(personne.get("telephone"), "TELEPHONE")


def assembler_contexte(d: DemandeRedaction, p: Pseudonymiseur) -> str:
    c = d.copropriete
    adresse = " ".join(str(x) for x in (c.get("adresse"), c.get("code_postal"), c.get("ville")) if x)
    lignes = [f"Copropriété : {c.get('nom')}", f"Adresse de l'immeuble : {adresse}"]

    for personne in d.personnes:
        _declarer_personne(p, personne)

    if d.source_type and d.source:
        src = d.source
        lignes.append(f"\nÉlément source ({d.source_type}) :")
        for champ in ("titre", "objet", "categorie", "statut", "priorite", "date", "type", "lieu", "echeance"):
            if src.get(champ):
                lignes.append(f"- {champ} : {src[champ]}")
        for champ in ("description", "notes", "transcription", "ordre_du_jour", "pv"):
            if src.get(champ):
                lignes.append(f"- {champ} :\n{_texte(src[champ])}")

    if d.destinataire:
        p.ajouter(d.destinataire)
        lignes.append(f"\nDestinataire : {d.destinataire}")

    return "\n".join(lignes)


def _decouper(texte: str) -> tuple[str, str]:
    m = re.match(r"\s*Objet\s*:\s*(.+?)\n(.*)", texte, flags=re.S | re.I)
    if not m:
        return "", texte.strip()
    return m.group(1).strip(), m.group(2).strip()


async def rediger(llm: OpenRouter, modele: str, d: DemandeRedaction) -> Brouillon:
    p = Pseudonymiseur()
    contexte = assembler_contexte(d, p)
    consignes = CONSIGNES_TYPE[d.type]
    if d.consignes:
        consignes += f"\nConsignes de la gestionnaire : {d.consignes}"

    message = p.masquer(f"Type de document : {d.type}\n{consignes}\n\nContexte :\n{contexte}")
    reponse = await llm.chat(
        modele,
        [{"role": "system", "content": SYSTEM}, {"role": "user", "content": message}],
    )
    objet, corps = _decouper(p.demasquer(reponse))
    return Brouillon(objet=objet, corps=corps, modele=modele)
