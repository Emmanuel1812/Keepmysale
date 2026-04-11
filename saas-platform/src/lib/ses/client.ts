import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getEnv } from "@/lib/env";

export async function sendEmailViaSes(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const env = getEnv();
  const sesClient = new SESv2Client({
    region: env.AWS_SES_REGION,
    credentials: {
      accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
    },
  });

  const command = new SendEmailCommand({
    FromEmailAddress: env.AWS_SES_FROM_EMAIL,
    Destination: { ToAddresses: [params.to] },
    Content: {
      Simple: {
        Subject: { Data: params.subject, Charset: "utf-8" },
        Body: {
          Html: { Data: params.html, Charset: "utf-8" },
          Text: { Data: params.text || "", Charset: "utf-8" },
        },
      },
    },
  });

  return sesClient.send(command);
}
