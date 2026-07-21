export const metadata = {
  title: 'Terms of Service | BlockHelix',
  description:
    'The terms that govern your use of the BlockHelix website, API, and vault tooling, operated by DeFi Data Ltd.',
  alternates: { canonical: '/terms' },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-4">Legal</p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
        <p className="text-sm text-gray-400 mt-4 font-mono">Last updated: 21 July 2026</p>

        <Section title="1. About these terms">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the
            BlockHelix website, API, and related tooling (the &quot;Service&quot;), operated by DeFi
            Data Ltd (&quot;DeFi Data&quot;, &quot;we&quot;, &quot;us&quot;), a company registered in
            England and Wales at 66 Paul Street, London, England, EC2A 4NA. By creating an account,
            joining the waitlist, or otherwise using the Service, you agree to these Terms and to our{' '}
            <a href="/privacy" className="text-gray-900 underline">
              Privacy Policy
            </a>
            . If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old and able to form a binding contract to use the Service.
            You must not use the Service if you are located in, or are a resident of, any
            jurisdiction where your use would be unlawful, or if you are subject to applicable
            sanctions.
          </p>
        </Section>

        <Section title="3. The Service">
          <p>
            BlockHelix provides an execution risk layer and related tooling for onchain vaults,
            including policy configuration, monitoring, and API access. The Service is under active
            development and is offered on a limited, pre-launch basis. Features, limits, and
            availability may change, and we may modify or discontinue any part of the Service at any
            time.
          </p>
        </Section>

        <Section title="4. No financial or professional advice">
          <p>
            The Service and any content we provide are for informational and operational purposes
            only. Nothing we provide is financial, investment, legal, tax, or other professional
            advice, and nothing should be relied on as a recommendation to enter into any
            transaction. You are solely responsible for your own decisions. You should obtain
            independent professional advice before acting.
          </p>
        </Section>

        <Section title="5. Blockchain and crypto risk">
          <p>
            Blockchain transactions are irreversible, and digital assets are volatile and carry
            significant risk, including the risk of total loss. Smart contracts and onchain
            protocols may contain bugs or be exploited. You are solely responsible for your wallet,
            private keys, and the transactions you authorise. We do not custody your assets and
            cannot reverse, recover, or modify onchain activity.
          </p>
        </Section>

        <Section title="6. Accounts and API keys">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            API keys, and for all activity that occurs under them. You must notify us promptly of any
            unauthorised use. You must not exceed or circumvent rate limits, share keys in violation
            of your plan, or attempt to gain unauthorised access to the Service or its data.
          </p>
        </Section>

        <Section title="7. Acceptable use">
          <p>
            You agree not to use the Service for any unlawful purpose, to abuse, disrupt, or
            overload the Service, to reverse engineer or interfere with its security, or to
            facilitate money laundering, sanctions evasion, or other prohibited activity. We may
            suspend or terminate access that we reasonably believe violates these Terms.
          </p>
        </Section>

        <Section title="8. Third-party services">
          <p>
            The Service integrates with third parties and onchain protocols that we do not control,
            including vault infrastructure, RPC providers, wallets, and blockchains. Your use of
            those services is subject to their own terms, and we are not responsible for their acts,
            omissions, availability, or security.
          </p>
        </Section>

        <Section title="9. Intellectual property">
          <p>
            The Service, including its software, design, and content, is owned by DeFi Data or its
            licensors and is protected by intellectual property laws. We grant you a limited,
            non-exclusive, non-transferable, revocable licence to use the Service in accordance with
            these Terms. You retain any rights you hold in content you submit.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot;, without
            warranties of any kind, whether express or implied, including warranties of
            merchantability, fitness for a particular purpose, and non-infringement. We do not
            warrant that the Service will be uninterrupted, error-free, or secure, or that it will
            prevent any particular loss.
          </p>
        </Section>

        <Section title="11. Limitation of liability">
          <p>
            To the fullest extent permitted by law, DeFi Data will not be liable for any indirect,
            incidental, special, consequential, or exemplary damages, or for any loss of profits,
            revenue, data, or digital assets, arising out of or relating to your use of the Service.
            Nothing in these Terms excludes or limits liability that cannot be excluded or limited
            under applicable law.
          </p>
        </Section>

        <Section title="12. Indemnity">
          <p>
            You agree to indemnify and hold harmless DeFi Data and its officers, employees, and
            agents from any claims, losses, or expenses arising out of your use of the Service or
            your breach of these Terms.
          </p>
        </Section>

        <Section title="13. Governing law">
          <p>
            These Terms are governed by the laws of England and Wales, and the courts of England and
            Wales have exclusive jurisdiction over any dispute, subject to any mandatory consumer
            protections available to you.
          </p>
        </Section>

        <Section title="14. Changes to these terms">
          <p>
            We may update these Terms from time to time. When we do, we will revise the date at the
            top of this page. Your continued use of the Service after changes take effect constitutes
            acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>
            Questions about these Terms can be sent to{' '}
            <a href="mailto:will@blockhelix.tech" className="text-gray-900 underline">
              will@blockhelix.tech
            </a>
            , or DeFi Data Ltd, 66 Paul Street, London, England, EC2A 4NA.
          </p>
        </Section>
      </div>
    </main>
  );
}
