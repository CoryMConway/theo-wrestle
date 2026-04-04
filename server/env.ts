export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  /** Demo mode: no real OAuth configured — use dev-login */
  isDemoMode: !process.env.OAUTH_SERVER_URL,
  hfToken: process.env.HF_TOKEN ?? "",
  hfModel: process.env.HF_MODEL ?? "meta-llama/Meta-Llama-3-8B-Instruct",
  port: parseInt(process.env.PORT ?? "3000", 10),
  /** SQLite database file path. On HuggingFace, /data is a persistent volume. */
  sqlitePath:
    process.env.SQLITE_PATH ??
    (process.env.NODE_ENV === "production"
      ? "/data/theowrestle.db"
      : "./theowrestle.db"),
};
