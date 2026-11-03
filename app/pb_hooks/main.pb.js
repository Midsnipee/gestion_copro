/// <reference path="../pb_data/types.d.ts" />

// Tout document importé entre dans la file d'ingestion du worker IA.
onRecordCreate((e) => {
  if (!e.record.get("ingestion")) {
    e.record.set("ingestion", "en_attente");
  }
  e.next();
}, "document");
