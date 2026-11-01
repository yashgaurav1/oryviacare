import Link from "next/link";
import { Wordmark } from "./header";
import { NewsletterForm } from "./forms";

interface PublicContact {
  phone?: string;
  email?: string;
  whatsapp?: string;
  hours?: string;
}

export function Footer({ contact }: { contact: PublicContact | null }) {
  return (
    <footer className="on-night mt-28 overflow-hidden">
      <span aria-hidden="true" className="orb -left-40 -top-40 h-[28rem] w-[28rem] bg-kesar/25" />
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <Wordmark className="text-kesar-light" />
          <p className="mt-4 max-w-sm text-on-night-muted">Skincare and hair care for everyday routines, with professional packages for salons and retailers.</p>
          <div className="footer-form mt-6 max-w-sm rounded-[22px] bg-surface p-5 text-ink">
            <NewsletterForm />
          </div>
        </div>
        <nav aria-label="Shop" className="md:col-span-2">
          <h2 className="eyebrow mb-4">Shop</h2>
          <ul className="space-y-2.5 text-on-night/85">
            <li><Link className="link-draw hover:text-on-night" href="/shop">All products</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/category/skin-care">Skin Care</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/category/hair-care">Hair Care</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/ingredients">Ingredients</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/packages">Professional packages</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help" className="md:col-span-2">
          <h2 className="eyebrow mb-4">Help</h2>
          <ul className="space-y-2.5 text-on-night/85">
            <li><Link className="link-draw hover:text-on-night" href="/track-order">Track an order</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/contact">Contact us</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/faq">FAQ</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/business">For business</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/careers">Careers</Link></li>
          </ul>
        </nav>
        <nav aria-label="Policies" className="md:col-span-2">
          <h2 className="eyebrow mb-4">Policies</h2>
          <ul className="space-y-2.5 text-on-night/85">
            <li><Link className="link-draw hover:text-on-night" href="/policies/privacy">Privacy</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/policies/terms">Terms</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/policies/shipping">Shipping</Link></li>
            <li><Link className="link-draw hover:text-on-night" href="/policies/returns">Returns &amp; refunds</Link></li>
          </ul>
        </nav>
        <div className="md:col-span-2">
          <h2 className="eyebrow mb-4">Contact</h2>
          {contact ? (
            <ul className="space-y-2.5 text-sm">
              {contact.phone && <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>}
              {contact.email && <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
              {contact.hours && <li className="text-on-night-muted">{contact.hours}</li>}
            </ul>
          ) : (
            <p className="text-sm text-on-night-muted">
              Use our <Link href="/contact" className="underline">contact form</Link>. Direct phone and WhatsApp details will appear once confirmed by Oryvia.
            </p>
          )}
        </div>
      </div>
      <p aria-hidden="true" className="pointer-events-none select-none px-5 text-center font-[family-name:var(--font-mark)] text-[clamp(4rem,19vw,17rem)] leading-[0.8] tracking-[0.12em] text-transparent [-webkit-text-stroke:1px_rgb(226_180_86/0.35)]">
        ORYVIA
      </p>
      <div className="border-t border-on-night/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-6 text-xs text-on-night-muted sm:px-8">
          <p>© {new Date().getFullYear()} Oryvia Care. All prices in INR.</p>
          <p>
            Designed by{" "}
            <a href="https://www.linkedin.com/in/yash-gaurav/" target="_blank" rel="noopener noreferrer" className="link-draw font-semibold text-kesar-light">
              Yash Gaurav
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
