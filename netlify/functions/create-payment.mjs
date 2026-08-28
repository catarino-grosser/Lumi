import { paymentsStore } from './lib/store.mjs';
import { randomUUID } from 'node:crypto';

// Pacotes de créditos disponíveis. Ajuste preços/quantidades como preferir.
const PACKS = {
  small: { price: 5, credits: 50, label: 'R$5 — 50 mensagens' },
  medium: { price: 10, credits: 120, label: 'R$10 — 120 mensagens' }
};

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return json({ error: { message: 'MERCADOPAGO_ACCESS_TOKEN não configurado no servidor.' } }, 500);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: { message: 'Corpo inválido.' } }, 400); }
  const { userId, packId, name, email, cpf } = body || {};
  const pack = PACKS[packId];
  if (!userId || !pack || !name || !email || !cpf) {
    return json({ error: { message: 'Dados incompletos para gerar o pagamento.' } }, 400);
  }

  const cpfDigits = String(cpf).replace(/\D/g, '');
  if (cpfDigits.length !== 11) {
    return json({ error: { message: 'CPF inválido. Informe os 11 números do CPF.' } }, 400);
  }

  const nameParts = String(name).trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || name;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

  // URL pública do próprio site nesse deploy, usada pra avisar o Mercado Pago
  // pra onde mandar a notificação automática quando o pagamento for aprovado.
  // Sem isso, só a checagem manual (polling em check-payment.mjs) credita —
  // o que funciona, mas depende do usuário deixar a aba aberta até confirmar.
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': randomUUID()
      },
      body: JSON.stringify({
        transaction_amount: pack.price,
        description: `Lumi - ${pack.label}`,
        payment_method_id: 'pix',
        notification_url: siteUrl ? `${siteUrl}/.netlify/functions/payment-webhook` : undefined,
        payer: {
          email,
          first_name: firstName,
          last_name: lastName,
          identification: { type: 'CPF', number: cpfDigits }
        }
      })
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      return json({ error: { message: mpData?.message || 'Falha ao criar pagamento Pix.' } }, mpRes.status);
    }

    await paymentsStore().setJSON(String(mpData.id), {
      userId, creditsToAdd: pack.credits, status: 'pending', createdAt: Date.now()
    });

    return json({
      paymentId: mpData.id,
      qrCode: mpData.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      status: mpData.status
    });
  } catch (err) {
    return json({ error: { message: err.message } }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
