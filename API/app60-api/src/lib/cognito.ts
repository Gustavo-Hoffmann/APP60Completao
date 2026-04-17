import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import type { AppConfig } from "../config.js";

export function createCognito(cfg: AppConfig) {
  return new CognitoIdentityProviderClient({ region: cfg.AWS_REGION });
}

export async function cognitoCreateUserWithPassword(
  client: CognitoIdentityProviderClient,
  cfg: AppConfig,
  input: { email: string; password: string; fullName: string }
): Promise<{ sub: string }> {
  const username = input.email.trim().toLowerCase();
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: cfg.COGNITO_USER_POOL_ID,
      Username: username,
      UserAttributes: [
        { Name: "email", Value: username },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: input.fullName.trim() },
      ],
      MessageAction: "SUPPRESS",
    })
  );

  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: cfg.COGNITO_USER_POOL_ID,
      Username: username,
      Password: input.password,
      Permanent: true,
    })
  );

  const gu = await client.send(
    new AdminGetUserCommand({
      UserPoolId: cfg.COGNITO_USER_POOL_ID,
      Username: username,
    })
  );
  const sub = gu.UserAttributes?.find((a) => a.Name === "sub")?.Value;
  if (!sub) throw new Error("Cognito não retornou sub.");
  return { sub };
}

export async function cognitoSetDisabled(
  client: CognitoIdentityProviderClient,
  cfg: AppConfig,
  username: string,
  disabled: boolean
) {
  if (disabled) {
    await client.send(
      new AdminDisableUserCommand({
        UserPoolId: cfg.COGNITO_USER_POOL_ID,
        Username: username,
      })
    );
  } else {
    await client.send(
      new AdminEnableUserCommand({
        UserPoolId: cfg.COGNITO_USER_POOL_ID,
        Username: username,
      })
    );
  }
}

export async function cognitoDeleteUser(
  client: CognitoIdentityProviderClient,
  cfg: AppConfig,
  username: string
) {
  await client.send(
    new AdminDeleteUserCommand({
      UserPoolId: cfg.COGNITO_USER_POOL_ID,
      Username: username.trim().toLowerCase(),
    })
  );
}

export async function cognitoUpdateEmail(
  client: CognitoIdentityProviderClient,
  cfg: AppConfig,
  oldUsername: string,
  newEmail: string
) {
  const email = newEmail.trim().toLowerCase();
  await client.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: cfg.COGNITO_USER_POOL_ID,
      Username: oldUsername,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ],
    })
  );
}
