interface Env {
  FORECAST_DB: D1Database;
  JWT_SECRET: string;
  SITE_URL: string;

  // Email one-time-code sign-in (the live flow).
  RESEND_API_KEY: string;
  EMAIL_FROM: string;

  // Microsoft OAuth — dormant, see js/auth.js login().
  MS_CLIENT_ID: string;
  MS_CLIENT_SECRET: string;
  MS_TENANT_ID: string;
  MS_REDIRECT_URI: string;
}

type CFPagesFunction = PagesFunction<Env>;
