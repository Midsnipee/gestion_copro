import { column, Schema, Table } from '@powersync/web';
import { TABLES, type TypeColonne } from '@copro/shared/tables';

// Types SQLite côté appareil (PowerSync ne connaît que text / integer / real)
const VERS_SQLITE: Record<TypeColonne, typeof column.text> = {
	text: column.text,
	uuid: column.text,
	date: column.text,
	timestamp: column.text,
	json: column.text,
	integer: column.integer,
	bool: column.integer,
	real: column.real
};

const tables = Object.fromEntries(
	Object.entries(TABLES).map(([nom, cols]) => [
		nom,
		new Table(
			{
				...Object.fromEntries(Object.entries(cols).map(([c, t]) => [c, VERS_SQLITE[t as TypeColonne]])),
				version: column.integer,
				created: column.text,
				updated: column.text
			},
			// La version de départ accompagne chaque modification : le serveur détecte ainsi
			// qu'une fiche a été modifiée entre-temps sur un autre appareil.
			{ trackPrevious: { columns: ['version'], onlyWhenChanged: false } }
		)
	])
);

export const AppSchema = new Schema(tables);
