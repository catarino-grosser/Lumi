# Sistema de créditos/pagamento da Lumi — como está organizado

## Arquivos
```
netlify/functions/
├── lib/
│   ├── store.mjs            → acesso central aos Blobs (créditos, pagamentos, travas)
│   └── credit-payment.mjs   → credita um pagamento aprovado sem duplicar
├── chat.mjs                 → fala com a Claude; só debita crédito se a resposta vier com sucesso
├── check-credits.mjs        → devolve o saldo atual do usuário
├── create-payment.mjs       → cria a cobrança Pix no Mercado Pago
├── check-payment.mjs        → chamado pelo front a cada poucos segundos; credita se aprovado
└── payment-webhook.mjs      → chamado automaticamente pelo Mercado Pago quando o status muda
```

## Duas formas de creditar, sem duplicar
Tanto `check-payment.mjs` (o front pergunta de tempos em tempos) quanto
`payment-webhook.mjs` (o Mercado Pago avisa sozinho) podem tentar creditar o
mesmo pagamento. Os dois passam pelo mesmo `creditApprovedPayment()`, que usa
uma trava atômica no Blobs — só quem chegar primeiro credita; o outro desiste
sem duplicar. Isso dá redundância (se o webhook falhar, o polling ainda
credita, e vice-versa) sem risco de dobrar o crédito.

## Variáveis de ambiente (Site settings → Environment variables)
- `ANTHROPIC_API_KEY` — chave da API da Claude
- `MERCADOPAGO_ACCESS_TOKEN` — Access Token do Mercado Pago

## ⚠️ Token de teste vs. token de produção
Comece testando com o **token de sandbox** (começa com `TEST-`), disponível em
*Suas integrações → Credenciais de teste* no painel do Mercado Pago. Só que
com token de teste, **um Pix pago de verdade pelo app do seu banco nunca vai
ser aprovado** — é preciso simular o pagamento pela própria API de teste do
Mercado Pago. Se você escanear o QR code com seu banco de verdade e o
pagamento nunca aparecer como aprovado, é provavelmente isso.

Quando for cobrar de verdade, troque para o Access Token de **produção**
(começa com `APP_USR-`).

## notification_url automática
`create-payment.mjs` já manda `notification_url` apontando para
`.../.netlify/functions/payment-webhook` ao criar cada Pix, então o Mercado
Pago sabe para onde avisar sozinho. Ainda assim, é recomendado cadastrar essa
mesma URL manualmente no painel de desenvolvedores do Mercado Pago, como
redundância.

## Se o crédito não cair mesmo com o pagamento aprovado
No Netlify: **Logs → Functions**, abra `check-payment` e `payment-webhook` e
veja se aparece algum erro. O `creditApprovedPayment()` nunca deixa uma falha
interna quebrar a resposta ao front (o pop-up fecha mesmo assim quando o
Mercado Pago diz "approved"), mas registra o erro nesses logs pra investigar.

## API em transição
Este código usa o endpoint clássico `/v1/payments`, hoje o mais estável e
documentado para Pix via Checkout Transparente. O Mercado Pago está migrando
aos poucos para uma API mais nova ("API Orders") — vale checar a
documentação deles de vez em quando:
https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix

## CNPJ/MEI e LGPD
Não sou advogado nem contador. Pra cobrar de verdade vale confirmar com um
contador se precisa de CNPJ/MEI, e ter uma política de privacidade simples no
site, já que vocês guardam um identificador do usuário e dados de pagamento.
