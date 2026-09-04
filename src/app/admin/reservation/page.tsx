import { redirect } from 'next/navigation';

/* Les adresses de réservation ont rejoint la page de leur logement. */
export default function AncienneReservation() {
  redirect('/admin/logements');
}
