declare global {
  namespace App {
    interface Platform {
      env: {
        WAITLIST: KVNamespace;
        DISCORD_WEBHOOK_URL: string;
      };
    }
  }
}

export { };
