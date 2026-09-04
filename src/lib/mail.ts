/**
 * L'envoi de courriels, s'il est configuré.
 *
 * Sans RESEND_API_KEY, le message est écrit dans le journal du serveur et la
 * fonction dit qu'aucun fournisseur n'est configuré - ce qui n'est pas une
 * panne. Un fournisseur qui refuse, lui, en est une, et l'appelant doit
 * pouvoir distinguer les deux : dans le premier cas la demande est simplement
 * à relever en base, dans le second il y a quelque chose à réparer.
 */
type Mail = { to: string; subject: string; html: string; replyTo?: string };

export async function envoyer(m: Mail): Promise<{ ok: boolean; detail: string; configure: boolean }> {
  const clef = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || 'IB Signature <onboarding@resend.dev>';
  const texte = m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  if (!clef) {
    console.log('\n----- COURRIEL (non envoyé, RESEND_API_KEY absente) -----');
    console.log('À :', m.to, '| Objet :', m.subject);
    console.log(texte.slice(0, 700));
    console.log('---------------------------------------------------------\n');
    return { ok: false, detail: 'aucun fournisseur configuré', configure: false };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${clef}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: texte, ...(m.replyTo ? { reply_to: m.replyTo } : {}) }),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}`, configure: true };
    return { ok: true, detail: 'envoyé', configure: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message || 'erreur inconnue', configure: true };
  }
}

export const echapper = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
