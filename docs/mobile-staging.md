# Mobile Staging (app60)

## O que é
O **Mobile Staging** é uma variante instalável separadamente do app mobile `app60`, usada para testes internos (QA), TestFlight e Android Internal Testing, validando o fluxo ponta a ponta **sem** afetar produção.

## API usada
Este app (quando `APP_VARIANT=staging`) aponta **exclusivamente** para:

- `https://api-staging.seniorsenseplus.com`

## Como rodar localmente em modo staging
No diretório `app60/`:

```bash
npm run start:staging
```

Isso inicializa o Expo em modo dev-client com `APP_VARIANT=staging`.

## Como gerar build iOS staging
No diretório `app60/`:

```bash
npm run build:ios:staging
```

## Como gerar build Android staging
No diretório `app60/`:

```bash
npm run build:android:staging
```

## Como instalar/testar
- iOS: via TestFlight / instalação interna do EAS conforme o fluxo do projeto.
- Android: via Internal Testing / APK/AAB interno conforme o fluxo do projeto.

## Como confirmar visualmente que é STAGING
Verifique:

- **Nome do app**: “SeniorSense+ Staging”
- **Badge na UI**: aparece “STAGING” no canto superior direito
- **API usada**: `API_BASE_URL` vem de `EXPO_PUBLIC_API_BASE_URL` e é validada em runtime para impedir produção/localhost quando `APP_VARIANT=staging`

## Variáveis públicas (EXPO_PUBLIC_*)
Estas variáveis são **públicas** e podem estar no app:

- `EXPO_PUBLIC_APP_VARIANT` (ex: `staging`)
- `EXPO_PUBLIC_API_BASE_URL` (ex: `https://api-staging.seniorsenseplus.com`)
- `EXPO_PUBLIC_COGNITO_REGION`
- `EXPO_PUBLIC_COGNITO_USER_POOL_ID`
- `EXPO_PUBLIC_COGNITO_CLIENT_ID`

## Variáveis públicas do Cognito no staging
No **staging**, o build deve receber explicitamente (via `app60/eas.json` ou variáveis do ambiente do EAS):

- `EXPO_PUBLIC_COGNITO_REGION`
- `EXPO_PUBLIC_COGNITO_USER_POOL_ID`
- `EXPO_PUBLIC_COGNITO_CLIENT_ID`

Essas variáveis são **públicas** e podem estar no app.

Importante:
- O app mobile deve usar **Cognito App Client público (sem secret)**.
- **Nunca** usar/embutir **App Client Secret** no mobile.

## Segredos que NUNCA podem entrar no app
Nunca colocar no app (nem em `EXPO_PUBLIC_*`, nem em `app.config.*`, nem em commits):

- `DATABASE_URL`
- `BOOTSTRAP_SECRET`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCESS_KEY_ID`
- senhas
- tokens privados
- qualquer segredo de servidor

## Checklist antes de testar com usuários reais
- Confirmar que o app instalado é o **“SeniorSense+ Staging”**
- Confirmar que o badge **STAGING** aparece na UI
- Confirmar que `EXPO_PUBLIC_API_BASE_URL` está setada para `https://api-staging.seniorsenseplus.com`
- Rodar `npx expo config --type public` e verificar se não há valores sensíveis
- Fazer busca no repo por chaves proibidas (ex.: `AWS_SECRET_ACCESS_KEY`, `DATABASE_URL`, etc.)
- Validar login e chamadas principais ponta a ponta com a API staging

