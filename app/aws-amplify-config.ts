const domain = (process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '').replace(/^https?:\/\//, '');

const config = {
  Auth: {
    Cognito: {
      region: process.env.NEXT_PUBLIC_COGNITO_REGION,
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      // v6 expects oauth under "loginWith"
      loginWith: {
        oauth: {
          domain,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [process.env.NEXT_PUBLIC_REDIRECT_SIGNIN],
          redirectSignOut: [process.env.NEXT_PUBLIC_REDIRECT_SIGNOUT],
          responseType: 'code',
        },
        // optional: tell Cognito we sign in with email (matches your pool)
        // username: 'email',
      },
    },
  },
};
export default config;
