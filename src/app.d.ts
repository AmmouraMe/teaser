declare global {
  namespace App {
    interface Locals {
      user?: { username: string; };
    }
    interface Platform {
      env: {
        WAITLIST: KVNamespace;
        DISCORD_WEBHOOK_URL: string;

        // Admin login (/auth/discord) — gated to a single username.
        // Also serves as the Discord join button's credentials; the same
        // OAuth app can do both, but BOTH redirect URIs must be registered.
        DISCORD_CLIENT_ID: string;
        DISCORD_CLIENT_SECRET: string;

        // Waitlist join buttons (/auth/join/<provider>). Any provider whose
        // vars are unset is simply not rendered — see configuredProviders().
        GITHUB_CLIENT_ID?: string;
        GITHUB_CLIENT_SECRET?: string;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        FACEBOOK_CLIENT_ID?: string;
        FACEBOOK_CLIENT_SECRET?: string;

        // Apple has no static secret: the client_secret is an ES256 JWT
        // minted per request from the private key, so it needs four vars.
        APPLE_CLIENT_ID?: string;      // the Services ID, not the App ID
        APPLE_TEAM_ID?: string;
        APPLE_KEY_ID?: string;
        APPLE_PRIVATE_KEY?: string;    // PKCS8 PEM contents
      };
    }
  }
}

export { };
