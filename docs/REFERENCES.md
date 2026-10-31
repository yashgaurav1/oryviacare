# References

No third-party application code was copied into this repository. Dependencies are used through their package APIs under their own licences (see `package-lock.json`).

| Reference | Used for | Code reused? |
| --- | --- | --- |
| Better Auth docs / package types (v1.7.14) | Node handler, Prisma adapter, two-factor plugin schema | No (library dependency) |
| Prisma 7 (prisma-client generator, adapter-pg, prisma.config.ts) | Schema, migrations, client | No (library dependency) |
| NestJS 11 | HTTP modules, guards, filters | No (library dependency) |
| Next.js 16 App Router | Storefront and workspaces | No (library dependency) |
| embedded-postgres 18.6 | Local PostgreSQL without Docker | No (dev dependency) |
| Lenis 1.3.26 (MIT) | Smooth inertial scrolling | No (library dependency) |
| Google Fonts via next/font: Fraunces, Manrope, Marcellus (SIL Open Font License) | Typography (D-022) | No (self-hosted at build by next/font) |
| Oryvia packaging photographs from the source site | Palette derived from the packs' black, gold, bottle green, copper and blush | No code; colours sampled by eye |

Benchmark product research (Apple, Aesop, Minimalist, Nykaa, Stripe, Linear, Vercel) has **not** been carried out yet; the current design applies the brief's stated principles. Record each reference here with date and the pattern it informs when it is done.
