import { redirect } from 'next/navigation';

/* Les photographies ont rejoint la page de leur logement : on ne travaille pas
   sur « les photographies », on travaille sur un appartement. L'ancienne
   adresse reste valable - un signet ne doit pas mourir d'un rangement. */
export default function AnciennesPhotos() {
  redirect('/admin/logements');
}
