import { creditApprovedPayment } from './lib/credit-payment.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('paymentId');
  if (!paymentId) return json({ error: 'paymentId obrigatório' }, 400);

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado.' }, 500);

  let payment;
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    payment = await mpRes.json();
    if (!mpRes.ok) {
      return json({ error: payment?.message || `Mercado Pago retornou ${mpRes.status}` }, mpRes.status);
    }
  } catch (err) {
    return json({ error: 'Falha ao consultar o Mercado Pago: ' + err.message }, 500);
  }

  let creditResult = null;
  if (payment.status === 'approved') {
    creditResult = await creditApprovedPayment(paymentId);
    if (creditResult && !creditResult.credited && creditResult.reason === 'error') {
      console.error('Pagamento aprovado mas falhou ao creditar:', paymentId, creditResult.error);
    }
  }

  // O status do Mercado Pago sempre é devolvido, mesmo que creditar tenha falhado —
  // assim o front sabe que o pagamento foi aprovado e pode fechar o pop-up,
  // independente de um eventual problema ao somar o crédito.
  return json({ status: payment.status, credited: creditResult ? creditResult.credited : null });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
