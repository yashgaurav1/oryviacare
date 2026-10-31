// HTML evidence extraction. Every value carries the source location it came from.
import * as cheerio from "cheerio";

export interface ImageRef {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  location: string;
}

export interface TextBlock {
  section: string | null;
  tag: string;
  text: string;
  location: string;
}

export interface PageExtract {
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  og: Record<string, string>;
  jsonLd: unknown[];
  breadcrumbs: string[];
  links: string[];
  images: ImageRef[];
  blocks: TextBlock[];
  contactTargets: Array<{ kind: "whatsapp" | "tel" | "mailto" | "social"; href: string; location: string }>;
  bundle: BundleExtract | null;
  priceArea: { current: string | null; reference: string | null; text: string | null } | null;
}

export interface BundleExtract {
  bundleId: string;
  widgetPrice: string | null;
  discountAmount: string | null;
  fixedPrice: string | null;
  components: Array<{ legacyId: string; name: string; qty: number; unitPrice: string | null; order: number; href: string | null }>;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function extractPage(html: string, pageUrl: string): PageExtract {
  const $ = cheerio.load(html);
  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).text()));
    } catch {
      jsonLd.push({ _unparsed: $(el).text().slice(0, 2000) });
    }
  });
  const og: Record<string, string> = {};
  $('meta[property^="og:"], meta[property^="product:"]').each((_, el) => {
    og[$(el).attr("property")!] = $(el).attr("content") ?? "";
  });

  const links = new Set<string>();
  const contactTargets: PageExtract["contactTargets"] = [];
  $("a[href]").each((i, el) => {
    const href = $(el).attr("href")!.trim();
    if (/wa\.me|api\.whatsapp\.com|whatsapp:/i.test(href)) contactTargets.push({ kind: "whatsapp", href, location: `a[${i}]` });
    else if (href.startsWith("tel:")) contactTargets.push({ kind: "tel", href, location: `a[${i}]` });
    else if (href.startsWith("mailto:")) contactTargets.push({ kind: "mailto", href, location: `a[${i}]` });
    else if (/instagram\.com|facebook\.com|youtube\.com|linkedin\.com|twitter\.com|x\.com\//i.test(href))
      contactTargets.push({ kind: "social", href, location: `a[${i}]` });
    try {
      links.add(new URL(href, pageUrl).toString());
    } catch {
      /* ignore malformed */
    }
  });

  const images: ImageRef[] = [];
  $("img").each((i, el) => {
    const $el = $(el);
    const src = $el.attr("data-src") || $el.attr("src") || "";
    if (!src || src.startsWith("data:")) return;
    let abs: string;
    try {
      abs = new URL(src, pageUrl).toString();
    } catch {
      return;
    }
    images.push({
      src: abs,
      alt: $el.attr("alt") ?? null,
      width: Number($el.attr("width")) || null,
      height: Number($el.attr("height")) || null,
      location: `img[${i}]${$el.closest(".woocommerce-product-gallery").length ? " gallery" : ""}`,
    });
  });

  // Text blocks grouped by nearest preceding heading, from the main content area.
  const root = $("main").length ? $("main") : $("body");
  root.find("script,style,noscript,svg,form,header,footer").remove();
  const blocks: TextBlock[] = [];
  let section: string | null = null;
  root.find("h1,h2,h3,h4,h5,h6,p,li,td,th,blockquote,summary,dt,dd").each((i, el) => {
    const tag = el.tagName.toLowerCase();
    const text = clean($(el).clone().children("ul,ol").remove().end().text());
    if (!text) return;
    if (/^h[1-6]$/.test(tag)) section = text;
    blocks.push({ section, tag, text, location: `${tag}[${i}]` });
  });

  const breadcrumbs = $(".ct-breadcrumbs a, .woocommerce-breadcrumb a, nav[aria-label*=readcrumb] a")
    .map((_, el) => clean($(el).text()))
    .get();

  let bundle: BundleExtract | null = null;
  const $b = $(".woosb-products").first();
  if ($b.length) {
    bundle = {
      bundleId: $b.closest(".woosb-wrap").attr("data-id") ?? "",
      widgetPrice: $b.attr("data-price") ?? null,
      discountAmount: $b.attr("data-discount-amount") ?? null,
      fixedPrice: $b.attr("data-fixed-price") ?? null,
      components: $b
        .find(".woosb-product")
        .map((_, el) => {
          const $p = $(el);
          return {
            legacyId: $p.attr("data-id") ?? "",
            name: $p.attr("data-name") ?? clean($p.find(".woosb-name a").text()),
            qty: Number($p.attr("data-qty") ?? 0),
            unitPrice: $p.attr("data-price") ?? null,
            order: Number($p.attr("data-order") ?? 0),
            href: $p.find(".woosb-name a").attr("href") ?? null,
          };
        })
        .get(),
    };
  }

  let priceArea: PageExtract["priceArea"] = null;
  const $price = $(".summary .price, .entry-summary .price, .ct-product-price .price, p.price").first();
  if ($price.length) {
    priceArea = {
      current: clean($price.find("ins .amount").first().text()) || clean($price.find(".amount").last().text()) || null,
      reference: clean($price.find("del .amount").first().text()) || null,
      text: clean($price.text()) || null,
    };
  }

  return {
    title: clean($("title").first().text()) || null,
    h1: clean($("h1").first().text()) || null,
    metaDescription: $('meta[name="description"]').attr("content") ?? null,
    canonical: $('link[rel="canonical"]').attr("href") ?? null,
    robots: $('meta[name="robots"]').attr("content") ?? null,
    og,
    jsonLd,
    breadcrumbs,
    links: [...links],
    images,
    blocks,
    contactTargets,
    bundle,
    priceArea,
  };
}
