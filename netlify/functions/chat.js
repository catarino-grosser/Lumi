// Esta função roda no servidor do Netlify, nunca no navegador de quem visita o site.
// A chave de API fica guardada como variável de ambiente (ANTHROPIC_API_KEY) e nunca
// é enviada para quem está conversando com a Lumi.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { message: 'ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Netlify.' }
      })
    };
  }

  try {
    const { system, messages } = JSON.parse(event.body || '{}');

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
        system,
        messages
      })
    });

    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
