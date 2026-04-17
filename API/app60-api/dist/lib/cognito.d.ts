import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { AppConfig } from "../config.js";
export declare function createCognito(cfg: AppConfig): CognitoIdentityProviderClient;
export declare function cognitoCreateUserWithPassword(client: CognitoIdentityProviderClient, cfg: AppConfig, input: {
    email: string;
    password: string;
    fullName: string;
}): Promise<{
    sub: string;
}>;
export declare function cognitoSetDisabled(client: CognitoIdentityProviderClient, cfg: AppConfig, username: string, disabled: boolean): Promise<void>;
export declare function cognitoDeleteUser(client: CognitoIdentityProviderClient, cfg: AppConfig, username: string): Promise<void>;
export declare function cognitoUpdateEmail(client: CognitoIdentityProviderClient, cfg: AppConfig, oldUsername: string, newEmail: string): Promise<void>;
