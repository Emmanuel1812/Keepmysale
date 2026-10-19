import type { Metadata } from "next";
import { LEGAL_CONTACT_EMAIL, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service · KeepMySale",
  description: "The terms for using KeepMySale.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <h2>The service</h2>
        <p>
          KeepMySale is an AI assistant for Shopify stores. It reads your customers&apos; support emails, drafts or
          sends replies, tracks orders, and can propose a partial refund or store credit when a customer wants to
          return an item. These terms are between you (the merchant) and Emmanuel Oudennaarden, operating KeepMySale
          from the Netherlands. By installing or using KeepMySale you accept them.
        </p>
      </section>

      <section>
        <h2>You stay in charge</h2>
        <ul>
          <li>AI answers can be wrong. Review drafts, or limit what the AI may send on its own, in Settings.</li>
          <li>You are responsible for what is sent in your name and for every refund you approve or enable.</li>
          <li>Refunds are executed through your Shopify store under the limits you set. You can switch the assistant
            off at any time.</li>
        </ul>
      </section>

      <section>
        <h2>Your customers&apos; rights</h2>
        <p>
          Offering a customer an alternative to a refund must never block, delay, or make conditional a right the
          customer has by law, such as the right to withdraw from an online purchase within 14 days in the EU. A
          customer who insists on returning the item must be able to do so. You are responsible for configuring
          KeepMySale in line with the consumer law of the countries you sell to, and you agree not to use it to
          pressure customers.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Do not use KeepMySale to send spam or misleading messages, to process mail you have no right to read, to
          break the law, or to attempt to disrupt or reverse-engineer the service. We may suspend access for abuse.
        </p>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          You keep ownership of your store and customer data. How we process it is described in the{" "}
          <a href="/privacy">Privacy Policy</a>. Where we process your customers&apos; personal data on your behalf,
          that policy forms our processing terms; contact us if you need a separate data processing agreement.
        </p>
      </section>

      <section>
        <h2>Price and cancellation</h2>
        <p>
          KeepMySale is currently offered free of charge during its pilot. If paid plans are introduced, the price
          and billing terms will be shown to you before any charge, and you can cancel at any time. Uninstalling the
          app ends the service and starts the erasure of your data as described in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Availability and liability</h2>
        <p>
          We work to keep KeepMySale running but provide it as is, without a guarantee of uninterrupted or
          error-free operation. To the extent the law allows, our liability is limited to the fees you paid in the
          three months before the event, and we are not liable for indirect loss such as lost sales or a refund you
          chose to approve. Nothing here limits liability that cannot be limited by law, including for intent or
          gross negligence.
        </p>
      </section>

      <section>
        <h2>Law and contact</h2>
        <p>
          Dutch law applies. Disputes go to the competent court in the Netherlands, unless mandatory consumer law
          gives you another forum. Questions: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
