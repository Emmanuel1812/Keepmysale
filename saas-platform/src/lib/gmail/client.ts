import { google } from "googleapis";
import { getEnv } from "@/lib/env";
import { decryptAes256, encryptAes256 } from "@/lib/encryption";
import type { IMerchant } from "@/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { MerchantService } from "@/services/merchant-service";

export function createOAuth2Client() {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth credentials are not fully configured in environment variables.");
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export async function refreshAccessToken(merchant: IMerchant) {
  if (!merchant.googleRefreshTokenEncrypted) {
    throw new Error("No refresh token available");
  }

  const oauth2Client = createOAuth2Client();
  const refreshToken = decryptAes256(merchant.googleRefreshTokenEncrypted);
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  const newAccessToken = credentials.access_token;

  if (newAccessToken) {
    const supabase = createSupabaseServiceClient();
    const merchantService = new MerchantService(supabase);
    await merchantService.update(merchant.id, {
      googleAccessTokenEncrypted: encryptAes256(newAccessToken),
    });
    return newAccessToken;
  }

  throw new Error("Failed to refresh access token");
}

export async function getValidAccessToken(merchant: IMerchant) {
  if (!merchant.googleAccessTokenEncrypted) {
    throw new Error("Merchant has no Google access token linked");
  }

  const accessToken = decryptAes256(merchant.googleAccessTokenEncrypted);
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    // Test if the token is still valid by making a simple request
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.getProfile({ userId: "me" });
    return accessToken;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === 401) {
      console.log("[GMAIL] Token expired, refreshing...");
      return refreshAccessToken(merchant);
    }
    throw err;
  }
}

export async function fetchNewEmails(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const response = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox category:primary newer_than:1d",
    maxResults: 5,
  });

  const messages = response.data.messages || [];
  const results = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const headers = detail.data.payload?.headers || [];
    const from = headers.find((h) => h.name === "From")?.value || "";
    const to = headers.find((h) => h.name === "To")?.value || "";
    const subject = headers.find((h) => h.name === "Subject")?.value || "";

    // Simplified body extraction
    let body = "";
    const parts = detail.data.payload?.parts || [];
    const plainPart = parts.find((p) => p.mimeType === "text/plain");
    if (plainPart?.body?.data) {
      body = Buffer.from(plainPart.body.data, "base64").toString("utf-8");
    } else if (detail.data.payload?.body?.data) {
       body = Buffer.from(detail.data.payload.body.data, "base64").toString("utf-8");
    }

    results.push({
      id: msg.id!,
      threadId: detail.data.threadId!,
      from,
      to,
      subject,
      body,
    });
  }

  return results;
}

export async function sendGmailReply(accessToken: string, params: { to: string, subject: string, html: string, threadId?: string }) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Get merchant email for the 'From' header
  const profile = await gmail.users.getProfile({ userId: "me" });
  const merchantEmail = profile.data.emailAddress;

  const subject = params.subject.startsWith("Re:") ? params.subject : `Re: ${params.subject}`;

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const messageParts = [
    `From: ${merchantEmail}`,
    `To: ${params.to}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    `Subject: ${utf8Subject}`,
    ``,
    params.html,
  ];
  const message = messageParts.join("\n");

  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: params.threadId,
    },
  });

  return res.data;
}

export async function markAsRead(accessToken: string, messageId: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
}
