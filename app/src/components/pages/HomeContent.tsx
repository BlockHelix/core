'use client';

import HelixHero from '@/components/HelixHero';
import StatsStrip from '@/components/sections/StatsStrip';
import ApiSection from '@/components/sections/ApiSection';
import MonitoringSection from '@/components/sections/MonitoringSection';
import AttributionSection from '@/components/sections/AttributionSection';
import TemplatesSection from '@/components/sections/TemplatesSection';
import ArchitectureSection from '@/components/sections/ArchitectureSection';
import ProblemSection from '@/components/sections/ProblemSection';
import AuthorizedSection from '@/components/sections/AuthorizedSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import LoopSection from '@/components/sections/LoopSection';
import WaitlistSection from '@/components/sections/WaitlistSection';

export default function HomeContent() {
  return (
    <main className="min-h-screen">
      <HelixHero />
      <StatsStrip />
      <ApiSection />
      <MonitoringSection />
      <AttributionSection />
      <TemplatesSection />
      <ArchitectureSection />
      {/* <ProblemSection /> */}
      {/* <AuthorizedSection /> */}
      {/* <HowItWorksSection /> */}
      <LoopSection />
      <WaitlistSection />
    </main>
  );
}
