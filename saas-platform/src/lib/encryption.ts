import crypto from "node:crypto";

function getKeyBuffer() {
  const keyHex = process.env.ENCRYPTION_KEY ?? "";
  if (keyHex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string.");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptAes256(value: string): string {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAes256(payload: string): string {
  const key = getKeyBuffer();
  const [ivHex, encryptedHex] = payload.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload format.");
  }
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
