// utils/auth.js — AWS Cognito authentication helpers

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

// ── GET TOKEN (used by API client) ────────

export function getAuthToken() {
  return new Promise((resolve) => {
    const user = userPool.getCurrentUser();
    if (!user) return resolve(null);

    user.getSession((err, session) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export function getCurrentUser() {
  return userPool.getCurrentUser();
}

// ── SIGN UP ───────────────────────────────

export function signUp(email, password, name) {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    userPool.signUp(email, password, attributes, null, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ── CONFIRM SIGN UP (email verification code) ──

export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ── SIGN IN ───────────────────────────────

export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve({
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          user,
        });
      },
      onFailure: reject,
      newPasswordRequired: (userAttributes) => {
        resolve({ requireNewPassword: true, user, userAttributes });
      },
      totpRequired: () => {
        resolve({ requireMFA: true, user });
      },
    });
  });
}

// ── SIGN OUT ──────────────────────────────

export function signOut() {
  const user = userPool.getCurrentUser();
  if (user) user.globalSignOut({ onSuccess: () => {}, onFailure: () => {} });
}

// ── FORGOT PASSWORD ───────────────────────

export function forgotPassword(email) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: resolve,
      onFailure: reject,
    });
  });
}

export function confirmForgotPassword(email, code, newPassword) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmPassword(code, newPassword, {
      onSuccess: resolve,
      onFailure: reject,
    });
  });
}
