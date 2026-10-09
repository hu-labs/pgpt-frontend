import { Amplify } from "aws-amplify";
import "aws-amplify/auth/enable-oauth-listener";

const redirectUri = `${window.location.origin}/`;
const cognitoDomain = new URL(import.meta.env.VITE_COGNITO_LOGIN_URL).host;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,

      loginWith: {
        oauth: {
          domain: cognitoDomain,
          scopes: ["openid", "email", "profile"],
          redirectSignIn: [redirectUri],
          redirectSignOut: [redirectUri],
          responseType: "code",
        },
      },
    },
  },
});
