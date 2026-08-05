'use client';

import HelixHero from '@/components/HelixHero';
import ApiSection from '@/components/sections/ApiSection';
import MonitoringSection from '@/components/sections/MonitoringSection';
import AttributionSection from '@/components/sections/AttributionSection';
import TemplatesSection from '@/components/sections/TemplatesSection';
import ProblemSection from '@/components/sections/ProblemSection';
import AuthorizedSection from '@/components/sections/AuthorizedSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import LoopSection from '@/components/sections/LoopSection';
import CategorySection from '@/components/sections/CategorySection';
import WaitlistSection from '@/components/sections/WaitlistSection';

export default function HomeContent() {
  return (
    <main className="min-h-screen">
      <HelixHero />
      <CategorySection />
      <ApiSection />
      <MonitoringSection />
      <AttributionSection />
      <TemplatesSection />
      {/* <ProblemSection /> */}
      {/* <AuthorizedSection /> */}
      {/* <HowItWorksSection /> */}
      <LoopSection />
      <WaitlistSection />
    </main>
  );
}
