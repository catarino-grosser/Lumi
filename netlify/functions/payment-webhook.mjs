import { creditApprovedPayment } from './lib/credit-payment.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let paymentId = null;
  try {
    const body = await req.json();
    paymentId = body?.data?.id || body?.id || null;
  } catch { /* corpo vazio ou inválido, tentamos pela query abaixo */ }

  if (!paymentId) {
    const url = new URL(req.url);
    paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');
  }

  if (!paymentId) return new Response('ok', { status: 200 });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;

  try {
    // Nunca confiamos no status que vem no corpo do webhook — sempre reconsultamos
    // o pagamento direto na Mercado Pago antes de liberar créditos.
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payment = await mpRes.json();

    if (payment.status === 'approved') {
      await creditApprovedPayment(paymentId);
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }

  return new Response('ok', { status: 200 });
};
