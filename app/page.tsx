import districts from "@/src/generated/districts.json";
import provinces from "@/src/generated/provinces.json";
import type { District, Province } from "@/lib/location-types";
import { HeroSection } from "@/components/public/HeroSection";
import { RegistrationForm } from "@/components/public/RegistrationForm";
import { SiteHeader } from "@/components/public/SiteHeader";

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#registration-form">
        Тіркелу формасына өту
      </a>
      <SiteHeader />
      <main>
        <HeroSection />
        <RegistrationForm
          provinces={provinces as Province[]}
          districts={districts as District[]}
        />
      </main>
      <footer className="site-footer shell">
        <span>© 2026 Zerdeli Urpaq</span>
      </footer>
    </>
  );
}
