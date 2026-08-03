export type PlatformIdentity = {
  identityKey: string;
  source: "platform_user_id" | "email_hash_fallback";
  displayName: string;
  email: string;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

function decodeFullName(request: Request): string | null {
  if (request.headers.get(USER_FULL_NAME_ENCODING_HEADER) !== PERCENT_ENCODED_UTF8) return null;
  const encodedName = request.headers.get(USER_FULL_NAME_HEADER);
  if (!encodedName) return null;
  try {
    return decodeURIComponent(encodedName);
  } catch {
    return null;
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getPlatformIdentity(request: Request): Promise<PlatformIdentity | null> {
  const email = request.headers.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) return null;

  const userId = request.headers.get(USER_ID_HEADER)?.trim();
  const fullName = decodeFullName(request);
  if (userId) {
    return {
      identityKey: `oai-user:${userId}`,
      source: "platform_user_id",
      displayName: fullName ?? email,
      email,
    };
  }

  return {
    identityKey: `oai-email-sha256:${await sha256(email)}`,
    source: "email_hash_fallback",
    displayName: fullName ?? email,
    email,
  };
}
