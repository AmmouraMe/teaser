declare global {
  namespace App {
    interface Locals {
      user?: { username: string; };
    }
    interface Platform {
      env: {
        WAITLIST: KVNamespace;
        DISCORD_WEBHOOK_URL: string;
        DISCORD_CLIENT_ID: string;
        DISCORD_CLIENT_SECRET: string;
      };
    }
  }
}

export { };
