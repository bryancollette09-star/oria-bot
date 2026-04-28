// ORIA Admin — Serverless function serving admin dashboard
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const htmlPath = path.join(process.cwd(), 'admin.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (e) {
    // Fallback: return a minimal redirect page
    return res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>ORIA Admin</title>
<script>
// inline fallback — admin.html not found
document.addEventListener('DOMContentLoaded', () => {
  document.body.innerHTML = '<p style="color:#c9a96e;font-family:sans-serif;padding:2rem">Erreur: admin.html introuvable — ' + ${JSON.stringify(e.message)} + '</p>';
});
</script>
</head><body></body></html>`);
  }
}
