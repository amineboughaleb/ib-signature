import type { ReactNode } from 'react';

export const metadata = {
  title: 'IB Signature',
  description: 'Conciergerie premium. Casablanca et Marrakech.',
};

/* La racine ne rend rien d'elle-même : la langue est portée par le segment
   [locale], et c'est lui qui pose <html lang>. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
