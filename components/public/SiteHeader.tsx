import Image from "next/image";
import Link from "next/link";

export function BrandMark() {
  return (
    <span className="brand" aria-label="Zerdeli Urpaq">
      <Image
        className="brand-logo"
        src="/assets/zerdeli-urpaq-logo-white.png"
        alt=""
        width={2043}
        height={770}
        loading="eager"
      />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header shell">
      <Link className="brand-link" href="/" aria-label="Zerdeli Urpaq басты беті">
        <BrandMark />
      </Link>
    </header>
  );
}
