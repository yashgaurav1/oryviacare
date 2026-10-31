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
    <footer className="mt-24 border-t border-divider bg-surface">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <Wordmark />
          <p className="mt-4 max-w-sm text-muted">Skincare and hair care for everyday routines, with professional packages for salons and retailers.</p>
          <div className="mt-6 max-w-sm">
            <NewsletterForm />
          </div>
        </div>
        <nav aria-label="Shop" className="md:col-span-2">
          <h2 className="eyebrow mb-4">Shop</h2>
          <ul className="space-y-2.5">
            <li><Link href="/shop">All products</Link></li>
            <li><Link href="/category/skin-care">Skin Care</Link></li>
            <li><Link href="/category/hair-care">Hair Care</Link></li>
            <li><Link href="/ingredients">Ingredients</Link></li>
            <li><Link href="/packages">Professional packages</Link></li>
          </ul>
        </nav>
        <nav aria-label="Help" className="md:col-span-2">
          <h2 className="eyebrow mb-4">Help</h2>
          <ul className="space-y-2.5">
            <li><Link href="/track-order">Track an order</Link></li>
            <li><Link href="/contact">Contact us</Link></li>
            <li><Link href="/faq">FAQ</Link></li>
            <li><Link href="/business">For business</Link></li>
            <li><Link href="/careers">Careers</Link></li>
          </ul>
        </nav>
        <nav aria-label="Policies" className="md:col-span-2">
          <h2 className="eyebrow mb-4">Policies</h2>
          <ul className="space-y-2.5">
            <li><Link href="/policies/privacy">Privacy</Link></li>
            <li><Link href="/policies/terms">Terms</Link></li>
            <li><Link href="/policies/shipping">Shipping</Link></li>
            <li><Link href="/policies/returns">Returns &amp; refunds</Link></li>
          </ul>
        </nav>
        <div className="md:col-span-2">
          <h2 className="eyebrow mb-4">Contact</h2>
          {contact ? (
            <ul className="space-y-2.5 text-sm">
              {contact.phone && <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>}
              {contact.email && <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
              {contact.hours && <li className="text-muted">{contact.hours}</li>}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Use our <Link href="/contact" className="underline">contact form</Link>. Direct phone and WhatsApp details will appear once confirmed by Oryvia.
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-divider">
        <p className="mx-auto max-w-[1400px] px-5 py-6 text-xs text-muted sm:px-8">© {new Date().getFullYear()} Oryvia Care. All prices in INR.</p>
      </div>
    </footer>
  );
}
