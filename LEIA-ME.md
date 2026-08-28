# Lumi — como está organizado

A Lumi agora é de graça: não existe mais sistema de créditos nem pagamento.
Qualquer pessoa que abrir o site pode conversar sem limite.

## Arquivos
```
index.html                       → front-end (esfera 3D, voz, chat)
netlify/functions/chat.mjs       → fala com a Claude, sem checar crédito nenhum
```

## Variável de ambiente (Site settings → Environment variables)
- `ANTHROPIC_API_KEY` — chave da API da Claude

## ⚠️ Sem limite = sem proteção contra abuso
Como não há mais créditos nem login, qualquer pessoa que descobrir a URL da
função `/.netlify/functions/chat` pode chamá-la direto, sem passar pela
página — o gasto na chave da Claude fica sem teto. Se isso virar um
problema, algumas opções pra depois (nenhuma implementada agora):
- Limite de requisições por IP (rate limiting) na própria função.
- Um "App Check" ou captcha simples antes de liberar o chat.
- Voltar a ter algum tipo de conta/limite, sem cobrar dinheiro.

## O que foi removido
Os arquivos de créditos, Pix e Mercado Pago (`check-credits.mjs`,
`create-payment.mjs`, `check-payment.mjs`, `payment-webhook.mjs`,
`lib/store.mjs`, `lib/credit-payment.mjs`) e a dependência `@netlify/blobs`
no `package.json` foram apagados — não são mais necessários.
