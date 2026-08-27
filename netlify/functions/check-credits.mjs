import { getOrCreateCredits } from './lib/store.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return json({ error: 'userId obrigatório' }, 400);

  const record = await getOrCreateCredits(userId);
  return json({ credits: record.credits });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
