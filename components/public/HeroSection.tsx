import { ArrowDown, CheckCircle2, Laptop, School, UsersRound } from "lucide-react";
import Image from "next/image";

export function HeroSection() {
  return (
    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-stars" aria-hidden="true" />
      <svg className="hero-doodle hero-doodle-book" viewBox="0 0 120 120" aria-hidden="true">
        <path d="M16 27c22-7 38-2 44 8v59c-9-10-25-13-44-7V27Zm88 0c-22-7-38-2-44 8v59c9-10 25-13 44-7V27Z" />
      </svg>
      <svg className="hero-doodle hero-doodle-pencil" viewBox="0 0 120 120" aria-hidden="true">
        <path d="m24 92 9-28 48-48 23 23-48 48-32 5Zm10-27 22 22M75 22l22 22" />
      </svg>

      <div className="hero-copy">
        <p className="eyebrow">ZERDELI URPAQ · 2026</p>
        <h1 id="hero-title">
          Олимпиадаға <span>тіркелу</span>
        </h1>
        <p className="hero-subtitle">3–4 сынып оқушыларына арналған Zerdeli Urpaq олимпиадасы</p>
        <p className="hero-description">
          Мектеп, сынып жетекшісі және 10 оқушының деректерін толтырыңыз.
        </p>
        <ul className="hero-chips" aria-label="Олимпиада туралы қысқаша ақпарат">
          <li>
            <School aria-hidden="true" /> 3–4 сынып
          </li>
          <li>
            <UsersRound aria-hidden="true" /> 10 оқушы
          </li>
          <li>
            <Laptop aria-hidden="true" /> Онлайн тіркелу
          </li>
        </ul>
        <a className="primary-button hero-button" href="#registration-form">
          Тіркеуді бастау <ArrowDown aria-hidden="true" />
        </a>
      </div>

      <div className="hero-media-wrap">
        <div className="hero-media-outline" aria-hidden="true" />
        <div className="hero-media">
          <Image
            src="/assets/zerdeli-students-group-2026.png"
            alt="Мұғаліммен бірге олимпиадаға дайындалып отырған оқушылар"
            fill
            priority
            sizes="(max-width: 900px) 92vw, 42vw"
          />
          <div className="hero-floating-badge">
            <CheckCircle2 aria-hidden="true" />
            <span>Сапалы білім, үздік нәтиже</span>
          </div>
        </div>
      </div>
    </section>
  );
}
