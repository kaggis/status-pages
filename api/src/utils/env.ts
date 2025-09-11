import 'dotenv/config';

export const PORT = Number(process.env.PORT) || 3000;
export const OIDC_ISSUER = process.env.OIDC_ISSUER;
export const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE;
export const CORS_ORIGIN = process.env.CORS_ORIGIN;
export const SECRET_KEY = process.env.SECRET_KEY;

export const validateEnvironment = (): void => {
  if (!OIDC_ISSUER || !OIDC_AUDIENCE || !CORS_ORIGIN || !SECRET_KEY) {
    console.error('❌ Missing required environment variables');
    console.error('Required: OIDC_ISSUER, OIDC_AUDIENCE, CORS_ORIGIN, SECRET_KEY');
    process.exit(1);
  }
};