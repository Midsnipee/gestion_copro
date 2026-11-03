from app.pseudonymisation import Pseudonymiseur


def test_masque_et_restaure_les_valeurs_declarees():
    p = Pseudonymiseur()
    p.ajouter("Marie Dupont")
    p.ajouter("Dupont")
    texte = "Mme Marie Dupont signale une fuite. Mme dupont relance."
    masque = p.masquer(texte)
    assert "Dupont" not in masque and "dupont" not in masque
    assert "[PERSONNE_1]" in masque and "[PERSONNE_2]" in masque
    assert p.demasquer(masque) == "Mme Marie Dupont signale une fuite. Mme Dupont relance."


def test_detecte_email_telephone_iban():
    p = Pseudonymiseur()
    texte = "Contact : jean.martin@exemple.fr, 06 12 34 56 78, +33612345678, IBAN FR76 3000 6000 0112 3456 7890 189."
    masque = p.masquer(texte)
    for fuite in ("jean.martin", "06 12 34", "+3361", "FR76"):
        assert fuite not in masque
    assert "[EMAIL_1]" in masque and "[TELEPHONE_1]" in masque and "[IBAN_1]" in masque
    assert p.demasquer(masque) == texte


def test_ne_touche_pas_aux_mots_contenant_le_nom():
    p = Pseudonymiseur()
    p.ajouter("Roux")
    assert p.masquer("Le Rouxel et M. Roux") == "Le Rouxel et M. [PERSONNE_1]"


def test_jeton_inconnu_laisse_tel_quel():
    assert Pseudonymiseur().demasquer("[PERSONNE_9]") == "[PERSONNE_9]"
