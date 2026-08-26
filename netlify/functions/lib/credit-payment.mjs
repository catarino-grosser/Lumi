import { getStore } from '@netlify/blobs';

// Credita um pagamento aprovado no saldo do usuário, sem creditar duas vezes.
//
// Duas rotas diferentes podem chegar aqui pro MESMO pagamento quase ao mesmo
// tempo: o polling do cliente em check-payment.mjs (a cada 4s) e o webhook do
// Mercado Pago em payment-webhook.mjs. Antes, cada uma fazia seu próprio
// "ler -> se não creditado -> somar -> marcar creditado" de forma independente
// e não-atômica, então as duas podiam ler status "pending" antes de qualquer
// uma escrever "credited", duplicando o crédito.
//
// Aqui usamos uma trava atômica baseada em onlyIfNew: só quem conseguir criar
// a chave de trava primeiro segue em frente e credita; a outra chamada só
// encontra a trava já criada e desiste sem duplicar nada.
export async function creditApprovedPayment(paymentId) {
  const paymentsStore = getStore('lumi-payments');
  const record = await paymentsStore.get(String(paymentId), { type: 'json' });
  if (!record) return { credited: false, reason: 'not-found' };
  if (record.status === 'credited') return { credited: false, reason: 'already-credited' };

  const lockStore = getStore('lumi-payment-locks');
  const lock = await lockStore.set(String(paymentId), '1', { onlyIfNew: true }).catch(() => null);
  if (!lock || !lock.modified) {
    // Outro processo já está creditando (ou já creditou) este pagamento agora.
    return { credited: false, reason: 'locked' };
  }

  const creditsStore = getStore('lumi-credits');
  const current = (await creditsStore.get(record.userId, { type: 'json' })) || { credits: 0 };
  current.credits = (current.credits || 0) + record.creditsToAdd;
  await creditsStore.setJSON(record.userId, current);

  record.status = 'credited';
  await paymentsStore.setJSON(String(paymentId), record);

  return { credited: true };
}
