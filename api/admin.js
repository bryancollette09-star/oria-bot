// ORIA Admin Analytics API — Vercel Serverless Function

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ADMIN_KEY = process.env.ADMIN_KEY || 'oria-admin-2026';
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) return res.status(500).json({ error: 'Supabase non configuré' });

  const h = { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` };

  try {
    const [usersRes, sessionsRes, messagesRes] = await Promise.all([
      fetch(`${sbUrl}/rest/v1/oria_users?select=id,created_at,derniere_connexion`, { headers: h }),
      fetch(`${sbUrl}/rest/v1/oria_sessions?select=id,module,started_at,ended_at,message_count,user_id`, { headers: h }),
      fetch(`${sbUrl}/rest/v1/oria_messages?select=content,role,module,created_at&role=eq.assistant&limit=1000`, { headers: h })
    ]);

    const [users, sessions, messages] = await Promise.all([
      usersRes.json(), sessionsRes.json(), messagesRes.json()
    ]);

    const MODULE_LABELS = {
      confiance: 'Confiance en soi',
      relations: 'Relations & Limites',
      emotions: 'Émotions',
      argent: 'Indépendance financière',
      ambition: 'Ambition & Vision',
      corps: 'Corps & Féminité',
      identite: 'Identité & Valeurs',
      toxique: 'Comportements toxiques',
      maternite: 'Maternité & Femme',
      communication: 'Communication',
      prepa_date: 'Prépa Date',
      debrief_date: 'Débrief Date'
    };

    const moduleStats = {};
    Object.keys(MODULE_LABELS).forEach(m => {
      moduleStats[m] = { label: MODULE_LABELS[m], sessions: 0, messages: 0, tokens: 0 };
    });

    sessions.forEach(s => {
      const m = s.module || 'confiance';
      if (!moduleStats[m]) moduleStats[m] = { label: m, sessions: 0, messages: 0, tokens: 0 };
      moduleStats[m].sessions++;
      moduleStats[m].messages += (s.message_count || 0);
    });

    messages.forEach(msg => {
      const m = msg.module || 'confiance';
      if (!moduleStats[m]) moduleStats[m] = { label: m, sessions: 0, messages: 0, tokens: 0 };
      moduleStats[m].tokens += Math.round((msg.content || '').length / 4);
    });

    const completed = sessions.filter(s => s.ended_at && s.started_at);
    const avgDuration = completed.length
      ? completed.reduce((a, s) => a + (new Date(s.ended_at) - new Date(s.started_at)) / 60000, 0) / completed.length
      : 0;

    const totalTokens = messages.reduce((a, m) => a + Math.round((m.content || '').length / 4), 0);
    const avgTokens = sessions.length ? Math.round(totalTokens / sessions.length) : 0;

    const dailyMap = {};
    sessions.forEach(s => {
      const d = (s.started_at || '').split('T')[0];
      if (!d) return;
      if (!dailyMap[d]) dailyMap[d] = { sessions: 0, users: new Set() };
      dailyMap[d].sessions++;
      if (s.user_id) dailyMap[d].users.add(s.user_id);
    });
    const dailyActivity = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b)).slice(-30)
      .map(([date, d]) => ({ date, sessions: d.sessions, users: d.users.size }));

    const now = Date.now();
    const activeUsers = users.filter(u => {
      const last = new Date(u.derniere_connexion || u.created_at);
      return (now - last) < 30 * 24 * 60 * 60 * 1000;
    }).length;

    const monthlySignups = {};
    users.forEach(u => {
      const month = (u.created_at || '').substring(0, 7);
      if (month) monthlySignups[month] = (monthlySignups[month] || 0) + 1;
    });

    return res.status(200).json({
      totalUsers: users.length,
      activeUsers,
      totalSessions: sessions.length,
      avgSessionMinutes: Math.round(avgDuration * 10) / 10,
      avgTokensPerSession: avgTokens,
      totalTokens,
      moduleStats,
      dailyActivity,
      monthlySignups,
      generatedAt: new Date().toISOString()
    });

  } catch (e) {
    console.error('Admin error:', e);
    return res.status(500).json({ error: 'Erreur serveur', detail: e.message });
  }
}
