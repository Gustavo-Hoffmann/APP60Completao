import {
  COGNITO_CLIENT_ID,
  COGNITO_REGION,
} from "../config/env";
import { clearTokens, saveTokens } from "./tokenStorage";

type InitiateAuthResult = {
  IdToken?: string;
  AccessToken?: string;
  RefreshToken?: string;
};

export async function signInWithPassword(email: string, password: string) {
  const region = COGNITO_REGION;
  const clientId = COGNITO_CLIENT_ID;
  const url = `https://cognito-idp.${region}.amazonaws.com/`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email.trim().toLowerCase(),
        PASSWORD: password,
      },
    }),
  });

  const json = (await res.json()) as {
    AuthenticationResult?: InitiateAuthResult;
    __type?: string;
    message?: string;
  };

  if (!res.ok || !json.AuthenticationResult?.IdToken) {
    throw new Error(json.message || "Falha no login.");
  }

  const ar = json.AuthenticationResult;
  await saveTokens({
    idToken: ar.IdToken!,
    accessToken: ar.AccessToken ?? "",
    refreshToken: ar.RefreshToken ?? "",
  });
}

export async function signOut() {
  await clearTokens();
}
