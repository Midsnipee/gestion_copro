"""Masque les données personnelles avant tout envoi vers un LLM cloud.

Les valeurs sensibles sont remplacées par des jetons stables ([PERSONNE_1],
[EMAIL_1]…) puis ré-injectées dans la réponse.
"""

import re

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
TEL_RE = re.compile(r"(?<!\d)(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}(?!\d)")
IBAN_RE = re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b")
TOKEN_RE = re.compile(r"\[([A-Z]+)_(\d+)\]")


class Pseudonymiseur:
    def __init__(self) -> None:
        self._par_valeur: dict[str, str] = {}
        self._par_jeton: dict[str, str] = {}
        self._compteurs: dict[str, int] = {}

    def ajouter(self, valeur: str | None, nature: str = "PERSONNE") -> str | None:
        """Déclare une valeur connue à masquer (nom, adresse personnelle…)."""
        if not valeur or not valeur.strip():
            return None
        valeur = valeur.strip()
        cle = valeur.casefold()
        if cle in self._par_valeur:
            return self._par_valeur[cle]
        nature = nature.upper()
        self._compteurs[nature] = self._compteurs.get(nature, 0) + 1
        jeton = f"[{nature}_{self._compteurs[nature]}]"
        self._par_valeur[cle] = jeton
        self._par_jeton[jeton] = valeur
        return jeton

    def masquer(self, texte: str) -> str:
        if not texte:
            return texte
        # Valeurs déclarées, les plus longues d'abord ("Marie Dupont" avant "Dupont")
        for cle in sorted(self._par_valeur, key=len, reverse=True):
            motif = re.compile(rf"(?<!\w){re.escape(cle)}(?!\w)", re.IGNORECASE)
            texte = motif.sub(self._par_valeur[cle], texte)
        texte = EMAIL_RE.sub(lambda m: self.ajouter(m.group(), "EMAIL"), texte)
        texte = IBAN_RE.sub(lambda m: self.ajouter(m.group(), "IBAN"), texte)
        texte = TEL_RE.sub(lambda m: self.ajouter(m.group(), "TELEPHONE"), texte)
        return texte

    def demasquer(self, texte: str) -> str:
        if not texte:
            return texte
        return TOKEN_RE.sub(lambda m: self._par_jeton.get(m.group(), m.group()), texte)
