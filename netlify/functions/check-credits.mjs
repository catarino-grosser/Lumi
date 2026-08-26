import { getStore } from '@netlify/blobs';

const FREE_TRIAL_CREDITS = 3;

export default async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return json({ error: 'userId obrigatório' }, 400);

  const store = getStore('lumi-credits');
  const record = (await store.get(userId, { type: 'json' })) || { credits: FREE_TRIAL_CREDITS };
  return json({ credits: record.credits });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
