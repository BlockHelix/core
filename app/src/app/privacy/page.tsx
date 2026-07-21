export const metadata = {
  title: 'Privacy Policy | BlockHelix',
  description:
    'How DeFi Data Ltd (BlockHelix) collects, uses, and protects your personal data, including analytics and cookies.',
  alternates: { canonical: '/privacy' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mt-4 font-mono">Last updated: 21 July 2026</p>

        <Section title="Who we are">
          <p>
            BlockHelix is operated by DeFi Data Ltd (&quot;DeFi Data&quot;, &quot;we&quot;,
            &quot;us&quot;), a company registered in England and Wales at 66 Paul Street, London,
            England, EC2A 4NA. We are the controller of the personal data described in this policy.
          </p>
          <p>
            This policy explains what personal data we collect when you use our website and API, how
            we use it, and the rights you have under UK data protection law.
          </p>
        </Section>

        <Section title="Information we collect">
          <p>
            <strong className="text-gray-900">Account and contact data.</strong> When you join the
            waitlist or create an account, we collect your email address and any name you provide,
            through our authentication provider.
          </p>
          <p>
            <strong className="text-gray-900">Wallet data.</strong> When you connect a wallet, we
            receive your public wallet address. We never receive or store your private keys or seed
            phrase.
          </p>
          <p>
            <strong className="text-gray-900">Usage, analytics, and device data.</strong> We collect
            analytics about how you use the site (pages viewed, referring links, approximate
            location derived from IP, device and browser type, and interactions such as clicks and
            scrolling). Our product analytics provider may also record session replays and heatmaps
            of your visit to help us improve usability. We also keep technical server logs (IP
            address, request metadata, timestamps).
          </p>
          <p>
            <strong className="text-gray-900">API data.</strong> If you generate API keys, we store
            the keys and metadata about the requests you make, including for rate limiting and abuse
            prevention.
          </p>
        </Section>

        <Section title="How we use your data">
          <p>
            We use personal data to operate and secure the service, authenticate you, respond to
            enquiries, send service and waitlist communications, prevent abuse and enforce usage
            limits, analyse and improve the product, and comply with our legal obligations.
          </p>
          <p>
            Our legal bases under UK GDPR are performance of a contract, our legitimate interests in
            running and securing the service, your consent (for optional analytics cookies and
            similar technologies), and compliance with legal obligations.
          </p>
        </Section>

        <Section title="Cookies, analytics, and your choices">
          <p>
            <strong className="text-gray-900">Essential cookies.</strong> Our authentication
            provider sets cookies that are strictly necessary to keep you signed in and to secure
            the service. These do not require consent and cannot be switched off through the site.
          </p>
          <p>
            <strong className="text-gray-900">Optional analytics cookies.</strong> We use{' '}
            <strong className="text-gray-900">Google Analytics 4</strong> (provided by Google) and{' '}
            <strong className="text-gray-900">PostHog</strong> (product analytics, including session
            replay and heatmaps) to understand how the site is used. These are optional and are used
            for analytics only. We do not use this data for advertising, and we do not sell it.
          </p>
          <p>
            <strong className="text-gray-900">Consent and region.</strong> We use Google Consent
            Mode. If you are in the UK, the European Economic Area, or Switzerland, these optional
            analytics cookies load only after you accept them through our cookie banner, and you can
            reject them at any time. Outside those regions, analytics run by default; you can still
            opt out at any time.
          </p>
          <p>
            <strong className="text-gray-900">Changing your choice.</strong> You can reopen your
            cookie choices at any time using the &quot;Cookie settings&quot; link in the footer. You
            can also install the{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 underline"
            >
              Google Analytics opt-out browser add-on
            </a>{' '}
            and control cookies through your browser settings.
          </p>
        </Section>

        <Section title="Service providers">
          <p>
            We share data with processors who help us run the service, including: Clerk
            (authentication), Google (Google Analytics), PostHog (product analytics and session
            replay), Amazon Web Services (hosting and infrastructure), Alchemy (blockchain RPC
            access), Resend (transactional and waitlist email), and GeoJS (approximate location
            derived from your IP address, used only to decide whether to show the cookie banner in
            your region). We do not sell your personal data. Some of these providers process data
            outside the UK or EEA, including in the United States.
          </p>
        </Section>

        <Section title="International transfers">
          <p>
            Where we or our providers transfer personal data outside the UK or EEA, we rely on
            appropriate safeguards such as the UK International Data Transfer Agreement, the EU
            Standard Contractual Clauses, or an adequacy decision, so that your data receives an
            equivalent level of protection.
          </p>
        </Section>

        <Section title="On-chain data">
          <p>
            Vault deployments, transactions, and policy changes are recorded on public blockchains,
            including Base. This on-chain data is public, permanent, and outside our control. We
            cannot modify or delete information that has been written to a blockchain.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We keep personal data for as long as your account is active or as needed to provide the
            service, and afterwards only as required to meet legal, accounting, or security
            obligations. Server and request logs, and analytics data, are retained for a limited
            period.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Subject to UK GDPR, you have the right to access, correct, delete, restrict, or object to
            the processing of your personal data, to data portability, and to withdraw consent. To
            exercise these rights, contact us using the details below. You also have the right to
            lodge a complaint with the UK Information Commissioner&apos;s Office (ICO).
          </p>
        </Section>

        <Section title="Security">
          <p>
            We take reasonable technical and organisational measures to protect personal data. No
            method of transmission or storage is fully secure, so we cannot guarantee absolute
            security.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The service is not directed to anyone under 18, and we do not knowingly collect data from
            children.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy from time to time. When we do, we will revise the date at the
            top of this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For any privacy question or request, contact us at{' '}
            <a href="mailto:will@blockhelix.tech" className="text-gray-900 underline">
              will@blockhelix.tech
            </a>
            , or write to DeFi Data Ltd, 66 Paul Street, London, England, EC2A 4NA.
          </p>
        </Section>
      </div>
    </main>
  );
}
