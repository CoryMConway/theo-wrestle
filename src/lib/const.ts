export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

export function getLoginUrl() {
  // Always use dev-login — in demo mode (no real OAuth) the server handles it.
  // When real OAuth is configured, the server returns 404 and we'd redirect to OAuth.
  return "/api/dev-login";
}
