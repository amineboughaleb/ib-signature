import { redirect } from 'next/navigation';

/* La racine mène au français : c'est la langue du compte, des propriétaires et
   de la clientèle d'affaires locale. L'anglais s'atteint d'un clic. */
export default function Racine() {
  redirect('/fr');
}
