import { paymentsStore, creditsStore, locksStore } from './store.mjs';

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
  try {
    const payments = paymentsStore();
    const record = await payments.get(String(paymentId), { type: 'json' });
    if (!record) return { credited: false, reason: 'not-found' };
    if (record.status === 'credited') return { credited: false, reason: 'already-credited' };

    const locks = locksStore();
    const lock = await locks.set(String(paymentId), '1', { onlyIfNew: true });
    if (!lock || !lock.modified) {
      // Outro processo já está creditando (ou já creditou) este pagamento agora.
      return { credited: false, reason: 'locked' };
    }

    const credits = creditsStore();
    const current = (await credits.get(record.userId, { type: 'json' })) || { credits: 0 };
    current.credits = (current.credits || 0) + record.creditsToAdd;
    await credits.setJSON(record.userId, current);

    record.status = 'credited';
    await payments.setJSON(String(paymentId), record);

    return { credited: true };
  } catch (err) {
    // Nunca deixa uma falha aqui (ex.: Blobs indisponível) derrubar quem chamou.
    // O pagamento pode já ter sido aprovado pelo Mercado Pago — quem chama
    // precisa saber disso mesmo que o crédito em si tenha falhado.
    console.error('creditApprovedPayment falhou:', err);
    return { credited: false, reason: 'error', error: err.message };
  }
}
