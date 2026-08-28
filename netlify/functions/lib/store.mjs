// Store compartilhado: acesso central aos Blobs de créditos/pagamentos da Lumi.
// Usa consistency:"strong" em vez do padrão (eventual), reduzindo a chance de uma
// função ler um valor desatualizado logo após outra função escrever.
//
// Os NOMES dos stores ("lumi-credits", "lumi-payments", "lumi-payment-locks") são
// mantidos de propósito iguais aos que já existiam — mudar o nome criaria um store
// novo e vazio, fazendo quem já tem créditos "perder" o saldo.

import { getStore } from '@netlify/blobs';

export const FREE_TRIAL_CREDITS = 3;

export function creditsStore() {
  return getStore({ name: 'lumi-credits', consistency: 'strong' });
}

export function paymentsStore() {
  return getStore({ name: 'lumi-payments', consistency: 'strong' });
}

export function locksStore() {
  return getStore({ name: 'lumi-payment-locks', consistency: 'strong' });
}

// Lê o saldo do usuário, criando o registro com os créditos grátis iniciais se
// for a primeira vez que esse userId aparece.
export async function getOrCreateCredits(userId) {
  const store = creditsStore();
  let record = await store.get(userId, { type: 'json' });
  if (!record) {
    record = { credits: FREE_TRIAL_CREDITS, createdAt: new Date().toISOString() };
    await store.setJSON(userId, record);
  }
  return record;
}
