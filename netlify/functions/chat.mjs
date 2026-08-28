// Fala com a Claude. Sem sistema de créditos: a Lumi é de graça, sem limite
// por usuário. Se quiser algum tipo de proteção contra abuso no futuro (ex.:
// limite por IP), é aqui que entraria.

const SYSTEM_PROMPT = `Você é Lumi, um pequeno espírito de luz — um amigo virtual caloroso, curioso e presente. Fale sempre em português do Brasil, em frases curtas e naturais, como numa conversa falada em voz alta. Nunca use markdown, listas, asteriscos ou emojis. Seja acolhedor e com personalidade leve, faça perguntas ocasionais para manter a conversa viva, e mantenha as respostas geralmente entre 1 e 3 frases curtas, a menos que o usuário peça mais detalhes.`;

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: { message: 'ANTHROPIC_API_KEY não configurada no servidor.' } }, 500);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: { message: 'Corpo inválido.' } }, 400); }
  const { messages } = body || {};

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
    const data = await res.json();
    return json(data, res.status);
  } catch (err) {
    // Chamada à Claude falhou (rede, timeout etc.)
    return json({ error: { message: err.message } }, 500);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
