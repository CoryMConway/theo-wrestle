export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** Demo mode: no real OAuth configured — use dev-login */
  isDemoMode: !process.env.OAUTH_SERVER_URL,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  port: parseInt(process.env.PORT ?? "3000", 10),
  /** SQLite database file path. On HuggingFace, /data is a persistent volume. */
  sqlitePath:
    process.env.SQLITE_PATH ??
    (process.env.NODE_ENV === "production"
      ? "/data/theowrestle.db"
      : "./theowrestle.db"),
};
