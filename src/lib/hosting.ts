export const OFFICIAL_HOST_ORIGIN = "https://coryconway-theowrestle.hf.space";

export function isOfficialHostedInstance(url: string): boolean {
  try {
    return new URL(url).origin === OFFICIAL_HOST_ORIGIN;
  } catch {
    return false;
  }
}
