import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { randomBytes } from "node:crypto";
import { ContactInput, NewsletterInput, PageQuery, QuoteRequestInput } from "@oryvia/contracts";
import { z } from "zod";
import { DbService } from "../core/db.js";
import { notFound, parse } from "../core/errors.js";
import { enqueueOutbox } from "../core/outbox.js";
import { CurrentPrincipal, type Principal } from "../core/principal.js";
import { priceVariants } from "../commerce/pricing.js";
import { availableByVariant } from "../commerce/stock.js";

const mediaUrl = (storageKey: string) => `/media/${storageKey.replace(/^public\/media\//, "")}`;
const ref = (prefix: string) => `${prefix}-${randomBytes(5).toString("hex").toUpperCase()}`;

const ProductListQuery = PageQuery.extend({
  category: z.string().max(80).optional(),
  q: z.string().trim().max(100).optional(),
  ingredient: z.string().max(80).optional(),
  sort: z.enum(["featured", "price_asc", "price_desc", "name_asc", "newest"]).default("featured"),
  inStock: z.enum(["1", "0"]).optional(),
});

@ApiTags("catalog")
@Controller("v1/catalog")
export class CatalogController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  private async cards(products: Array<{ id: string }>) {
    const full = await this.db.client.product.findMany({
      where: { id: { in: products.map((p) => p.id) } },
      include: {
        variants: { where: { active: true } },
        media: { orderBy: { sortOrder: "asc" }, take: 2, include: { asset: true } },
        categories: { include: { category: true } },
        ingredients: { where: { relationKind: "featured" }, include: { ingredient: true } },
      },
    });
    const variantIds = full.flatMap((p) => p.variants.map((v) => v.id));
    const prices = await priceVariants(this.db.client, variantIds);
    const stock = await availableByVariant(this.db.client, variantIds);
    const byId = new Map(full.map((p) => [p.id, p]));
    return products.map(({ id }) => {
      const p = byId.get(id)!;
      const v = p.variants[0];
      const price = v ? prices.get(v.id) : undefined;
      const available = v ? (stock.get(v.id) ?? 0) : 0;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        variantId: v?.id ?? null,
        packSize: v?.title ?? null,
        pricePaise: price?.unitPaise ?? null,
        // Unverified "original price" values are never shown as a strike-through (see visual review: they exceed printed MRP).
        referencePaise: price && !/not verified/i.test(price.referenceLabel ?? "not verified") ? price.referencePaise : null,
        referenceLabel: price && !/not verified/i.test(price.referenceLabel ?? "not verified") ? price.referenceLabel : null,
        availability: !price ? "not_for_sale" : available > 0 ? "in_stock" : "out_of_stock",
        availableQuantity: available,
        images: p.media.map((m) => ({ src: mediaUrl(m.asset.storageKey), alt: m.asset.alt ?? p.name, width: m.asset.width, height: m.asset.height })),
        categories: p.categories.map((c) => ({ slug: c.category.slug, name: c.category.name })),
        featuredIngredients: p.ingredients.map((i) => ({ slug: i.ingredient.slug, name: i.ingredient.name })),
      };
    });
  }

  @Get("products")
  async list(@Query() raw: Record<string, string>) {
    const q = parse(ProductListQuery, raw);
    const where = {
      status: "published" as const,
      ...(q.category ? { categories: { some: { category: { slug: q.category, status: "published" as const } } } } : {}),
      ...(q.ingredient ? { ingredients: { some: { ingredient: { slug: q.ingredient } } } } : {}),
      ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" as const } }, { shortDescription: { contains: q.q, mode: "insensitive" as const } }] } : {}),
    };
    const all = await this.db.client.product.findMany({ where, select: { id: true, name: true, sortOrder: true, publishedAt: true } });
    let cards = await this.cards(all);
    if (q.inStock === "1") cards = cards.filter((c) => c.availability === "in_stock");
    const by = {
      featured: (a: (typeof cards)[number], b: (typeof cards)[number]) => (all.find((x) => x.id === a.id)!.sortOrder - all.find((x) => x.id === b.id)!.sortOrder) || a.name.localeCompare(b.name),
      price_asc: (a: (typeof cards)[number], b: (typeof cards)[number]) => (a.pricePaise ?? Infinity) - (b.pricePaise ?? Infinity) || a.name.localeCompare(b.name),
      price_desc: (a: (typeof cards)[number], b: (typeof cards)[number]) => (b.pricePaise ?? -1) - (a.pricePaise ?? -1) || a.name.localeCompare(b.name),
      name_asc: (a: (typeof cards)[number], b: (typeof cards)[number]) => a.name.localeCompare(b.name),
      newest: (a: (typeof cards)[number], b: (typeof cards)[number]) =>
        (all.find((x) => x.id === b.id)!.publishedAt?.getTime() ?? 0) - (all.find((x) => x.id === a.id)!.publishedAt?.getTime() ?? 0) || a.name.localeCompare(b.name),
    }[q.sort];
    cards.sort(by);
    const total = cards.length;
    const items = cards.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  @Get("products/:slug")
  async detail(@Param("slug") slug: string) {
    const p = await this.db.client.product.findFirst({
      where: { slug, status: "published" },
      include: {
        media: { orderBy: { sortOrder: "asc" }, include: { asset: true } },
        ingredients: { include: { ingredient: true }, orderBy: { position: "asc" } },
        categories: { include: { category: true } },
        reviews: { where: { state: "published" }, orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!p) throw notFound("Product");
    const [card] = await this.cards([p]);
    const related = await this.db.client.product.findMany({
      where: { status: "published", id: { not: p.id }, categories: { some: { categoryId: { in: p.categories.map((c) => c.categoryId) } } } },
      select: { id: true },
      take: 4,
    });
    const ratings = p.reviews.map((r) => r.rating);
    return {
      ...card,
      descriptionSections: p.descriptionSections,
      keyFeatures: p.keyFeatures,
      directions: p.directions,
      precautions: p.precautions,
      details: p.details,
      packaging: p.packaging,
      fullIngredientList: p.fullIngredientList,
      manufacturer: p.manufacturer,
      countryOfOrigin: p.countryOfOrigin,
      images: p.media.map((m) => ({ src: mediaUrl(m.asset.storageKey), alt: m.asset.alt ?? p.name, width: m.asset.width, height: m.asset.height })),
      seo: { title: p.seoTitle, description: p.seoDescription ?? p.shortDescription },
      reviews: p.reviews.map((r) => ({ id: r.id, rating: r.rating, title: r.title, body: r.body, author: r.authorDisplay, verifiedPurchase: r.verifiedPurchase, date: r.createdAt })),
      rating: ratings.length ? { average: ratings.reduce((a, b) => a + b, 0) / ratings.length, count: ratings.length } : null,
      related: await this.cards(related),
    };
  }

  @Get("categories")
  async categories() {
    const cats = await this.db.client.category.findMany({
      where: { status: "published" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { image: true, _count: { select: { products: { where: { product: { status: "published" } } } } } },
    });
    return cats.map((c) => ({ slug: c.slug, name: c.name, description: c.description, image: c.image ? { src: mediaUrl(c.image.storageKey), alt: c.image.alt ?? c.name } : null, productCount: c._count.products }));
  }

  @Get("ingredients")
  async ingredients() {
    const rows = await this.db.client.ingredient.findMany({
      where: { products: { some: { product: { status: "published" } } } },
      orderBy: { name: "asc" },
      include: { products: { where: { product: { status: "published" } }, include: { product: { select: { slug: true, name: true } } } } },
    });
    return rows.map((i) => ({
      slug: i.slug,
      name: i.name,
      // Explanations are shown only after editorial approval; nothing is invented.
      summary: ["approved", "published"].includes(i.editorialStatus) ? i.summary : null,
      cosmeticRole: ["approved", "published"].includes(i.editorialStatus) ? i.cosmeticRole : null,
      editorialStatus: i.editorialStatus,
      products: i.products.map((p) => ({ slug: p.product.slug, name: p.product.name, relation: p.relationKind, sourceNote: p.sourceNote })),
    }));
  }
}

@ApiTags("packages")
@Controller("v1/packages")
export class PackagesController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Get()
  async list() {
    const pkgs = await this.db.client.package.findMany({
      where: { status: { in: ["needs_review", "published"] } },
      orderBy: { name: "asc" },
      include: { versions: { orderBy: { version: "desc" }, include: { components: { include: { variant: { include: { product: { select: { name: true, slug: true, status: true } } } } } } } } },
    });
    return pkgs.map((p) => {
      const approved = p.versions.find((v) => v.approvalState === "approved");
      const latest = p.versions[0];
      return {
        slug: p.slug,
        name: p.name,
        purchasable: false, // package checkout requires partner ordering (Phase F); approved packages are sold via quote
        state: approved ? "approved" : "under_review",
        pricePaise: approved?.pricePaise ?? null,
        components: approved
          ? approved.components.map((c) => ({ product: c.variant.product.name, slug: c.variant.product.slug, paidQty: c.paidQty, freeQty: c.freeQty }))
          : (latest?.components ?? []).map((c) => ({ product: c.variant.product.name, slug: c.variant.product.slug, paidQty: null, freeQty: null })),
        totalUnits: approved ? approved.components.reduce((s, c) => s + c.paidQty + c.freeQty, 0) : null,
        notice: approved ? null : "Price and exact composition are being confirmed with Oryvia. Request a quote for current terms.",
      };
    });
  }

  @Get(":slug")
  async detail(@Param("slug") slug: string) {
    const all = await this.list();
    const p = all.find((x) => x.slug === slug);
    if (!p) throw notFound("Package");
    return p;
  }
}

@ApiTags("enquiries")
@Controller("v1")
export class EnquiryController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Post("contact")
  async contact(@Body() body: unknown, @CurrentPrincipal() p: Principal | null) {
    const input = parse(ContactInput, body);
    const result = await this.db.client.$transaction(async (tx) => {
      const consent = await tx.consentEvent.create({ data: { userId: p?.userId, email: input.email, purpose: "reply_to_enquiry", decision: true, source: "contact_form" } });
      const enquiry = await tx.contactEnquiry.create({
        data: { reference: ref("ENQ"), userId: p?.userId, name: input.name, email: input.email, phone: input.phone || null, topic: input.topic, message: input.message },
      });
      await tx.followUpTask.create({ data: { enquiryId: enquiry.id, subjectKey: `enquiry:${enquiry.id}`, title: `Reply to ${input.topic} enquiry ${enquiry.reference}`, dueAt: new Date(Date.now() + 24 * 3600_000) } });
      await enqueueOutbox(tx, "enquiry.created", enquiry.id, { to: input.email, reference: enquiry.reference, consentEventId: consent.id });
      return enquiry;
    });
    return { reference: result.reference, status: result.status };
  }

  @Post("quotes")
  async quote(@Body() body: unknown, @CurrentPrincipal() p: Principal | null) {
    const input = parse(QuoteRequestInput, body);
    const pkg = input.packageSlug ? await this.db.client.package.findUnique({ where: { slug: input.packageSlug } }) : null;
    if (input.packageSlug && !pkg) throw notFound("Package");
    const account = p?.memberships.find((m) => m.accountStatus === "active");
    const q = await this.db.client.$transaction(async (tx) => {
      const q = await tx.quoteRequest.create({
        data: {
          reference: ref("QTE"),
          packageId: pkg?.id,
          businessAccountId: account?.accountId,
          contactName: input.contactName,
          email: input.email,
          phone: input.phone,
          businessName: input.businessName || null,
          city: input.city || null,
          message: input.message || null,
        },
      });
      await tx.followUpTask.create({ data: { subjectKey: `quote:${q.id}`, title: `Respond to quote request ${q.reference}`, dueAt: new Date(Date.now() + 24 * 3600_000) } });
      await enqueueOutbox(tx, "quote.requested", q.id, { to: input.email, reference: q.reference });
      return q;
    });
    return { reference: q.reference, status: q.status };
  }

  @Post("newsletter")
  async newsletter(@Body() body: unknown, @CurrentPrincipal() p: Principal | null) {
    const input = parse(NewsletterInput, body);
    const existing = await this.db.client.newsletterSubscription.findUnique({ where: { email: input.email } });
    if (existing?.status === "subscribed") return { status: "already_subscribed" };
    await this.db.client.$transaction(async (tx) => {
      const consent = await tx.consentEvent.create({ data: { userId: p?.userId, email: input.email, purpose: "marketing_email", decision: true, source: "newsletter_form" } });
      await tx.newsletterSubscription.upsert({
        where: { email: input.email },
        create: { email: input.email, consentEventId: consent.id },
        update: { status: "subscribed", consentEventId: consent.id, unsubscribedAt: null },
      });
    });
    return { status: "subscribed" };
  }
}

@ApiTags("content")
@Controller("v1/content")
export class ContentController {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  @Get("articles")
  async articles() {
    const rows = await this.db.client.article.findMany({ where: { status: "published", publishedAt: { lte: new Date() } }, orderBy: { publishedAt: "desc" } });
    return rows.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, publishedAt: a.publishedAt, authorName: a.authorName }));
  }

  @Get("articles/:slug")
  async article(@Param("slug") slug: string) {
    const a = await this.db.client.article.findFirst({ where: { slug, status: "published", publishedAt: { lte: new Date() } } });
    if (!a) throw notFound("Article");
    return { slug: a.slug, title: a.title, excerpt: a.excerpt, body: a.body, publishedAt: a.publishedAt, authorName: a.authorName, seo: { title: a.seoTitle, description: a.seoDescription ?? a.excerpt } };
  }

  @Get("policies/:key")
  async policy(@Param("key") key: string) {
    const v = await this.db.client.policyVersion.findFirst({ where: { policyKey: key, reviewState: "published" }, orderBy: { version: "desc" } });
    const pending = await this.db.client.policyVersion.count({ where: { policyKey: key, reviewState: { in: ["observed", "needs_review", "approved"] } } });
    if (!v) return { key, state: pending ? "pending_approval" : "missing", title: null, body: null, version: null, publishedAt: null };
    return { key, state: "published", title: v.title, body: v.body, version: v.version, publishedAt: v.publishedAt };
  }

  @Get("pages/:slug")
  async page(@Param("slug") slug: string) {
    const page = await this.db.client.contentPage.findFirst({ where: { slug, status: "published" }, include: { versions: { where: { reviewState: "published" }, orderBy: { version: "desc" }, take: 1 } } });
    if (!page || !page.versions[0]) return { slug, state: "pending_approval", title: null, body: null };
    return { slug, state: "published", title: page.title, body: page.versions[0].body };
  }

  @Get("settings/public")
  async publicSettings() {
    const keys = ["contact.public", "announcement", "shipping.rule"];
    const rows = await this.db.client.storeSetting.findMany({ where: { key: { in: keys } } });
    const get = (k: string) => rows.find((r) => r.key === k);
    const ship = get("shipping.rule")?.value as { label?: string; isDevelopment?: boolean } | undefined;
    return {
      contact: get("contact.public")?.verified ? get("contact.public")!.value : null,
      announcement: get("announcement")?.verified ? get("announcement")!.value : null,
      shipping: ship ? { label: ship.label, isDevelopment: !!ship.isDevelopment } : null,
    };
  }
}
