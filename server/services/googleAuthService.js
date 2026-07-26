import { google } from "googleapis";

const createGoogleOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_LOGIN_REDIRECT_URI,
  );
};

export const getGoogleLoginUrl = () => {
  const client = createGoogleOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "consent",
  });
};

export const exchangeCodeForTokens = async (code) => {
  const client = createGoogleOAuthClient();

  const { tokens } = await client.getToken(code);

  client.setCredentials(tokens);

  return {
    client,
    tokens,
  };
};

export const getGoogleUserInfo = async (client) => {
  const oauth2 = google.oauth2({
    auth: client,
    version: "v2",
  });

  const { data } = await oauth2.userinfo.get();

  return {
    googleId: data.id,
    name: data.name,
    email: data.email,
    picture: data.picture,
  };
};

export const authenticateGoogleUser = async (code) => {
    const { client } = await exchangeCodeForTokens(code);
    return getGoogleUserInfo(client);
};