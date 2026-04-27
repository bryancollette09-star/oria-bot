// ORIA — Auth API · Identification par email
// Crée ou récupère une utilisatrice via son email

module.exports = async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { email, prenom } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Configuration manquante — contacte le support' });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    const emailClean = email.toLowerCase().trim();

    // ── Chercher l'utilisatrice existante ─────────────────
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/oria_users?email=eq.${encodeURIComponent(emailClean)}&select=*`,
      { headers }
    );
    const users = await checkRes.json();

    if (users && users.length > 0) {
      const user = users[0];

      // Mettre à jour la dernière connexion
      await fetch(
        `${SUPABASE_URL}/rest/v1/oria_users?id=eq.${user.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ derniere_connexion: new Date().toISOString() })
        }
      );

      return res.json({
        userId: user.id,
        prenom: user.prenom || null,
        isNew: false
      });
    }

    // ── Créer une nouvelle utilisatrice ───────────────────
    const createRes = await fetch(
      `${SUPABASE_URL}/rest/v1/oria_users`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          email: emailClean,
          prenom: prenom ? prenom.trim() : null
        })
      }
    );

    const newUsers = await createRes.json();

    if (!newUsers || !newUsers[0]) {
      throw new Error('Création utilisatrice échouée');
    }

    return res.json({
      userId: newUsers[0].id,
      prenom: newUsers[0].prenom || null,
      isNew: true
    });

  } catch (error) {
    console.error('ORIA Auth error:', error);
    return res.status(500).json({ error: 'Erreur de connexion — réessaie' });
  }
};
