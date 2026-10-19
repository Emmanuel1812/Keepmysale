import type { Metadata } from "next";
import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · KeepMySale",
  description: "What KeepMySale collects, why, who processes it, and how to have it erased.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <h2>Who we are</h2>
        <p>
          KeepMySale is an AI customer-support assistant for Shopify stores. It is operated by Emmanuel Oudennaarden
          in the Netherlands. You can reach us at <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
        <p>
          For the account of the store owner (the merchant) we are the data controller. For the data of the
          merchant&apos;s own customers we are a processor: the merchant decides why that data is used, and we process
          it only to provide the service.
        </p>
      </section>

      <section>
        <h2>What we process</h2>
        <ul>
          <li>
            <strong>Merchant account:</strong> shop domain, shop name, the owner&apos;s email address, the subscription
            status, and the access token Shopify gives us when you install the app (stored encrypted).
          </li>
          <li>
            <strong>Store data from Shopify:</strong> orders (order number, items, totals, payment and fulfilment
            status, tracking details) and customers (name, email address, phone number where Shopify provides it).
          </li>
          <li>
            <strong>Support messages:</strong> the emails between your customers and you, when you connect your
            Gmail account or forward mail to us, including the replies drafted or sent through KeepMySale.
          </li>
          <li>
            <strong>Google account details:</strong> your Google email address and profile name, used to show which
            mailbox is connected.
          </li>
          <li>
            <strong>Return and refund records:</strong> the offers made to a customer, the outcome, and refunds issued
            through Shopify.
          </li>
        </ul>
        <p>
          We do not use advertising or analytics trackers. The only cookies we set are the session cookies needed to
          keep you signed in.
        </p>
      </section>

      <section>
        <h2>Why we use it</h2>
        <p>
          To show your orders and conversations, to classify incoming customer emails, to draft or send answers
          (for example where an order is), to propose partial refunds or store credit in a return conversation
          within the limits you set, and to issue refunds you approve. We do not sell data and we do not use your
          or your customers&apos; data to train models ourselves.
        </p>
      </section>

      <section>
        <h2>AI processing</h2>
        <p>
          To understand and answer a customer&apos;s message we send the text of that message and the relevant order
          details (such as order number, items and tracking status) to our AI providers: Google (Gemini) and, if that
          is unavailable, Groq. They process it only to return a response. Replies in draft mode are not sent until
          you approve them; you control whether the AI may send automatically, and you stay responsible for what is
          sent in your name.
        </p>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          If you connect Gmail, KeepMySale requests permission to read, send and modify mail in that mailbox and to
          see your email address and profile name. We use this only to read customer support emails, mark them as
          processed, and send replies you or your settings approve. We do not use it for advertising, and we do not
          allow people to read your mail except where needed for security, to comply with law, or with your consent.
        </p>
        <p>
          KeepMySale&apos;s use and transfer to any other app of information received from Google APIs will adhere to
          the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User
          Data Policy</a>, including the Limited Use requirements. You can revoke access at any time in your Google
          account under Security &rarr; Third-party access, or by disconnecting Gmail in KeepMySale Settings.
        </p>
      </section>

      <section>
        <h2>Who else processes data</h2>
        <ul>
          <li>Supabase: database and sign-in (hosted in Ireland, EU).</li>
          <li>Vercel: hosting of the application.</li>
          <li>Shopify: the platform you install the app on; we read and write store data through its API.</li>
          <li>Google (Gmail API, Gemini) and Groq: email access and AI processing, as described above.</li>
          <li>Amazon Web Services (SES): sending and receiving email when you use forwarding instead of Gmail.</li>
          <li>Mollie: payments, if and when a paid plan is active for your account.</li>
        </ul>
        <p>
          Some of these providers process data outside the European Economic Area. Where that happens we rely on the
          safeguards the provider offers, such as standard contractual clauses.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep merchant and store data while the app is installed. If you uninstall, Shopify asks us to erase the
          shop&apos;s data 48 hours later, and we do. A customer of yours who asks to be erased is removed through
          Shopify&apos;s privacy requests: we delete their record and conversations and strip their email from their
          orders. You can also delete your whole account yourself under Settings &rarr; Account. Refund records may be
          kept in anonymised form where the law requires financial records.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Connections use TLS. Shopify and Google access tokens are encrypted at rest (AES-256). Access to the
          database is restricted to the application and the operator. No system is perfectly secure; if a breach
          affects your data we will tell you and, where required, the authorities.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          Under the GDPR you may ask for access to your data, correction, erasure, restriction, a portable copy, and
          you may object to processing. If you are a customer of one of our merchants, please also contact the store
          you bought from. Write to <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>; we answer
          within one month. You may complain to the Dutch Data Protection Authority
          (<a href="https://autoriteitpersoonsgegevens.nl">Autoriteit Persoonsgegevens</a>).
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes in a way that matters, we will update the date above and tell merchants by email.</p>
      </section>
    </LegalPage>
  );
}
