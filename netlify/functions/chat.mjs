import { creditsStore, FREE_TRIAL_CREDITS } from './lib/store.mjs';

const SYSTEM_PROMPT = `Você é Lumi, um pequeno espírito de luz — um amigo virtual caloroso, curioso e presente. Fale sempre em português do Brasil, em frases curtas e naturais, como numa conversa falada em voz alta. Nunca use markdown, listas, asteriscos ou emojis. Seja acolhedor e com personalidade leve, faça perguntas ocasionais para manter a conversa viva, e mantenha as respostas geralmente entre 1 e 3 frases curtas, a menos que o usuário peça mais detalhes.`;

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: { message: 'ANTHROPIC_API_KEY não configurada no servidor.' } }, 500);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: { message: 'Corpo inválido.' } }, 400); }
  const { messages, userId } = body || {};

  // Lê o saldo (sem debitar ainda) só para checar se o usuário tem crédito
  // disponível antes de gastar uma chamada à Claude.
  const credits = userId ? creditsStore() : null;
  let creditRecord = null;
  let creditEtag = null;

  if (credits) {
    const existing = await credits.getWithMetadata(userId, { type: 'json' });
    creditRecord = existing?.data || { credits: FREE_TRIAL_CREDITS };
    creditEtag = existing?.etag || null;
    if (creditRecord.credits <= 0) {
      return json({ error: { message: 'Créditos esgotados.', code: 'NO_CREDITS' } }, 402);
    }
  }

  let data, status;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages
      })
    });
    data = await res.json();
    status = res.status;
  } catch (err) {
    // Chamada à Claude falhou (rede, timeout etc.) — não debita crédito nenhum.
    return json({ error: { message: err.message } }, 500);
  }

  // Só debitamos o crédito DEPOIS de confirmar que a Claude respondeu com sucesso.
  // Assim, um erro/falha da API não consome o crédito do usuário à toa.
  if (status >= 200 && status < 300 && credits) {
    const updated = { ...creditRecord, credits: creditRecord.credits - 1 };
    const writeOpts = creditEtag ? { onlyIfMatch: creditEtag } : { onlyIfNew: true };
    const result = await credits.setJSON(userId, updated, writeOpts).catch(() => null);
    if (!result || !result.modified) {
      // Outra requisição concorrente do mesmo usuário escreveu entre a nossa
      // leitura e a escrita (ex.: duas mensagens quase simultâneas). Tenta mais
      // uma vez, sem condição, pra não travar a resposta por causa disso.
      const fresh = (await credits.get(userId, { type: 'json' })) || { credits: FREE_TRIAL_CREDITS };
      fresh.credits = Math.max(0, fresh.credits - 1);
      await credits.setJSON(userId, fresh).catch(() => {});
    }
  }

  return json(data, status);
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
