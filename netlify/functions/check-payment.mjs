import { creditApprovedPayment } from './lib/credit-payment.mjs';

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
      await creditApprovedPayment(paymentId);
    }

    return json({ status: payment.status });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
