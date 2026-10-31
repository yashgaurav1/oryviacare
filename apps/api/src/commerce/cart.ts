// Server-backed carts. Guests hold an opaque random token in an HttpOnly cookie; only its hash is stored.
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@oryvia/db";
import { AppError, notFound } from "../core/errors.js";
import { buildQuote } from "./pricing.js";

export const CART_COOKIE = "oryvia_cart";
const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface CartOwner {
  userId: string | null;
  guestToken: string | null;
}

export class CartService {
  constructor(private readonly db: Db) {}

  async find(owner: CartOwner) {
    if (owner.userId) return this.db.cart.findFirst({ where: { userId: owner.userId, status: "active" }, orderBy: { updatedAt: "desc" } });
    if (owner.guestToken) return this.db.cart.findFirst({ where: { guestTokenHash: hashToken(owner.guestToken), status: "active", userId: null } });
    return null;
  }

  /** Returns the cart and, for a new guest cart, the token the caller must set as a cookie. */
  async findOrCreate(owner: CartOwner): Promise<{ cart: NonNullable<Awaited<ReturnType<CartService["find"]>>>; newGuestToken: string | null }> {
    const existing = await this.find(owner);
    if (existing) return { cart: existing, newGuestToken: null };
    if (owner.userId) {
      const cart = await this.db.cart.create({ data: { userId: owner.userId, expiresAt: new Date(Date.now() + CART_TTL_MS) } });
      return { cart, newGuestToken: null };
    }
    const token = randomBytes(32).toString("base64url");
    const cart = await this.db.cart.create({ data: { guestTokenHash: hashToken(token), expiresAt: new Date(Date.now() + CART_TTL_MS) } });
    return { cart, newGuestToken: token };
  }

  async view(owner: CartOwner) {
    const cart = await this.find(owner);
    if (!cart) return { id: null, version: 0, items: [], removed: [], quote: await buildQuote(this.db, []) };
    return this.viewById(cart.id);
  }

  async viewById(cartId: string) {
    const cart = await this.db.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: { variant: { include: { product: { include: { media: { orderBy: { sortOrder: "asc" }, take: 1, include: { asset: true } } } } } } },
        },
      },
    });
    const live = cart.items.filter((i) => !i.removedAt && i.variantId);
    const quote = await buildQuote(this.db, live.map((i) => ({ variantId: i.variantId!, quantity: i.quantity })));
    const items = live.map((i) => {
      const line = quote.lines.find((l) => l.variantId === i.variantId);
      const img = i.variant?.product.media[0]?.asset;
      return {
        id: i.id,
        variantId: i.variantId!,
        quantity: i.quantity,
        productSlug: i.variant!.product.slug,
        productName: i.variant!.product.name,
        variantTitle: i.variant!.title,
        image: img ? { src: `/media/${img.storageKey.replace(/^public\/media\//, "")}`, alt: img.alt ?? i.variant!.product.name } : null,
        unitPaise: line?.unitPaise ?? null,
        lineSubtotalPaise: line?.lineSubtotalPaise ?? null,
        availableQuantity: line?.availableQuantity ?? 0,
        problem: quote.problems.find((p) => p.variantId === i.variantId) ?? null,
      };
    });
    const recentlyRemoved = cart.items
      .filter((i) => i.removedAt && Date.now() - i.removedAt.getTime() < 15 * 60 * 1000)
      .map((i) => ({ id: i.id, productName: i.variant?.product.name ?? "Item", quantity: i.quantity }));
    return { id: cart.id, version: cart.version, items, removed: recentlyRemoved, quote };
  }

  async addItem(owner: CartOwner, variantId: string, quantity: number) {
    const { cart, newGuestToken } = await this.findOrCreate(owner);
    const variant = await this.db.variant.findFirst({ where: { id: variantId, active: true, product: { status: "published" } } });
    if (!variant) throw new AppError(422, "validation_failed", "This product is not available");
    await this.db.$transaction(async (tx) => {
      const existing = await tx.cartItem.findFirst({ where: { cartId: cart.id, variantId, removedAt: null } });
      if (existing) {
        const next = Math.min(existing.quantity + quantity, 99);
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: next } });
      } else {
        await tx.cartItem.create({ data: { cartId: cart.id, variantId, quantity } });
      }
      await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
    });
    return { view: await this.viewById(cart.id), newGuestToken };
  }

  private async ownedItem(owner: CartOwner, itemId: string) {
    const cart = await this.find(owner);
    if (!cart) throw notFound("Cart");
    const item = await this.db.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw notFound("Cart item");
    return { cart, item };
  }

  async setQuantity(owner: CartOwner, itemId: string, quantity: number) {
    const { cart, item } = await this.ownedItem(owner, itemId);
    await this.db.cartItem.update({ where: { id: item.id }, data: { quantity, removedAt: null } });
    await this.db.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
    return this.viewById(cart.id);
  }

  async remove(owner: CartOwner, itemId: string) {
    const { cart, item } = await this.ownedItem(owner, itemId);
    await this.db.cartItem.update({ where: { id: item.id }, data: { removedAt: new Date() } });
    await this.db.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
    return this.viewById(cart.id);
  }

  async restore(owner: CartOwner, itemId: string) {
    const { cart, item } = await this.ownedItem(owner, itemId);
    if (!item.removedAt) return this.viewById(cart.id);
    const dup = await this.db.cartItem.findFirst({ where: { cartId: cart.id, variantId: item.variantId, removedAt: null } });
    if (dup) {
      await this.db.cartItem.update({ where: { id: dup.id }, data: { quantity: Math.min(dup.quantity + item.quantity, 99) } });
      await this.db.cartItem.delete({ where: { id: item.id } });
    } else await this.db.cartItem.update({ where: { id: item.id }, data: { removedAt: null } });
    return this.viewById(cart.id);
  }

  /**
   * Deterministic guest → user merge after sign-in: quantities add, capped at 99; invalid items are reported,
   * never silently dropped. The guest cart is closed so it cannot be merged twice.
   */
  async mergeGuestIntoUser(userId: string, guestToken: string) {
    const guest = await this.db.cart.findFirst({ where: { guestTokenHash: hashToken(guestToken), status: "active", userId: null }, include: { items: { where: { removedAt: null } } } });
    const { cart: target } = await this.findOrCreate({ userId, guestToken: null });
    const report: Array<{ variantId: string; outcome: "merged" | "capped" | "not_available" }> = [];
    if (!guest) return { view: await this.viewById(target.id), report };
    await this.db.$transaction(async (tx) => {
      for (const gi of guest.items) {
        if (!gi.variantId) continue;
        const ok = await tx.variant.findFirst({ where: { id: gi.variantId, active: true, product: { status: "published" } } });
        if (!ok) {
          report.push({ variantId: gi.variantId, outcome: "not_available" });
          continue;
        }
        const existing = await tx.cartItem.findFirst({ where: { cartId: target.id, variantId: gi.variantId, removedAt: null } });
        const sum = (existing?.quantity ?? 0) + gi.quantity;
        const qty = Math.min(sum, 99);
        if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: qty } });
        else await tx.cartItem.create({ data: { cartId: target.id, variantId: gi.variantId, quantity: qty } });
        report.push({ variantId: gi.variantId, outcome: qty < sum ? "capped" : "merged" });
      }
      await tx.cart.update({ where: { id: guest.id }, data: { status: "merged" } });
      await tx.cart.update({ where: { id: target.id }, data: { version: { increment: 1 } } });
    });
    return { view: await this.viewById(target.id), report };
  }
}
