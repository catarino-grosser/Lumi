import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('paymentId');
  if (!paymentId) return json({ error: 'paymentId obrigatório' }, 400);

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado.' }, 500);

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payment = await mpRes.json();

    if (payment.status === 'approved') {
      const paymentsStore = getStore('lumi-payments');
      const record = await paymentsStore.get(String(paymentId), { type: 'json' });
      if (record && record.status !== 'credited') {
        const creditsStore = getStore('lumi-credits');
        const current = (await creditsStore.get(record.userId, { type: 'json' })) || { credits: 0 };
        current.credits = (current.credits || 0) + record.creditsToAdd;
        await creditsStore.setJSON(record.userId, current);
        record.status = 'credited';
        await paymentsStore.setJSON(String(paymentId), record);
      }
    }

    return json({ status: payment.status });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
