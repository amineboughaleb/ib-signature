import { redirect } from 'next/navigation';
import { administrationConfiguree, connecte } from '@/lib/admin';
import Connexion from './Connexion';

export const dynamic = 'force-dynamic';

/**
 * La porte.
 *
 * Déjà connecté, on ne voit jamais ce formulaire : on va directement aux avis,
 * qui sont ce pour quoi on vient neuf fois sur dix.
 */
export default async function Porte() {
  if (await connecte()) redirect('/admin/avis');
  return <Connexion configuree={administrationConfiguree()} />;
}
