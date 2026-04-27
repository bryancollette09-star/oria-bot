// ORIA — Summary API · Résumé fin de session
// Génère un résumé coaching et le sauvegarde dans Supabase

const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { sessionId, userId } = req.body || {};

  if (!sessionId || !userId) {
    return res.status(400).json({ error: 'sessionId et userId requis' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'Configuration manquante' });
  }

  const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // ── Récupérer les messages de la session ──────────────
    const msgsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/oria_messages?session_id=eq.${sessionId}&order=created_at.asc&select=role,content,module`,
      { headers: sbHeaders }
    );
    const messages = await msgsRes.json();

    if (!messages || messages.length < 2) {
      // Session trop courte — on sauvegarde juste la fin
      await fetch(
        `${SUPABASE_URL}/rest/v1/oria_sessions?id=eq.${sessionId}`,
        {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ ended_at: new Date().toISOString() })
        }
      );
      return res.json({ ok: true, resume: null });
    }

    // ── Construire la conversation pour Claude ────────────
    const conversation = messages.map(m =>
      `[${m.role === 'user' ? 'ELLE' : 'ORIA'}] : ${m.content}`
    ).join('\n\n');

    // ── Générer le résumé avec Claude ─────────────────────
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `Tu es ORIA, coach IA de OSE Le Cercle.
Après chaque session de coaching, tu génères une fiche mémoire concise et précise sur la femme que tu viens d'accompagner.
Cette fiche sera relue à ta prochaine session avec elle pour que tu puisses rebondir sur ce qui a été dit.

FORMAT DE LA FICHE (5 points max, phrases courtes) :
- Module(s) travaillé(s)
- Son défi principal du moment
- Prise(s) de conscience clé(s) de cette session
- Patterns ou blocages identifiés
- Engagement(s) ou prochaine étape évoquée(s)

Sois précise, factuelle, sans jugement. Pas de listes à puces — phrases simples séparées par des retours à la ligne.`,
      messages: [
        {
          role: 'user',
          content: `Voici la session de coaching à résumer :\n\n${conversation}\n\nGénère la fiche mémoire.`
        }
      ]
    });

    const resume = response.content[0].text;

    // ── Sauvegarder le résumé et fermer la session ────────
    await fetch(
      `${SUPABASE_URL}/rest/v1/oria_sessions?id=eq.${sessionId}`,
      {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({
          ended_at: new Date().toISOString(),
          resume,
          message_count: messages.length
        })
      }
    );

    return res.json({ ok: true, resume });

  } catch (error) {
    console.error('ORIA Summary error:', error);
    return res.status(500).json({ error: 'Erreur de résumé' });
  }
};
