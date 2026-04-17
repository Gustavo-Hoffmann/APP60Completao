import {
  AuthenticationDetails,
  CognitoUser,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";
import { getCognitoPool } from "./pool";

export async function getValidIdToken(): Promise<string | null> {
  const pool = getCognitoPool();
  const user = pool.getCurrentUser();
  if (!user) return null;

  return new Promise((resolve) => {
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export function signInWithPassword(email: string, password: string): Promise<void> {
  const pool = getCognitoPool();
  const authenticationDetails = new AuthenticationDetails({
    Username: email.trim().toLowerCase(),
    Password: password,
  });
  const cognitoUser = new CognitoUser({
    Username: email.trim().toLowerCase(),
    Pool: pool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: () => resolve(),
      onFailure: (e) => reject(e),
    });
  });
}

export function signOutCognito(): void {
  const pool = getCognitoPool();
  const user = pool.getCurrentUser();
  if (user) {
    user.signOut();
  }
}

export function changeOwnPassword(
  email: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const pool = getCognitoPool();
  const authenticationDetails = new AuthenticationDetails({
    Username: email.trim().toLowerCase(),
    Password: oldPassword,
  });
  const cognitoUser = new CognitoUser({
    Username: email.trim().toLowerCase(),
    Pool: pool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: () => {
        cognitoUser.changePassword(oldPassword, newPassword, (err) => {
          if (err) reject(err);
          else resolve();
        });
      },
      onFailure: (e) => reject(e),
    });
  });
}
