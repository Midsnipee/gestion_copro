import { Navigate, useParams } from 'react-router';
import { ListeModule } from '../modules/ListeModule';
import { module } from '../modules/definitions';

export function PageModule() {
	const { cle = '' } = useParams();
	const m = module(cle);
	if (!m) return <Navigate to="/" replace />;
	return (
		<>
			<div className="entete-page">
				<h1>{m.titre}</h1>
			</div>
			<ListeModule key={m.cle} m={m} />
		</>
	);
}
