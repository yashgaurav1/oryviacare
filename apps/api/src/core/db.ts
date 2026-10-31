import { Global, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { createPrisma } from "@oryvia/db";
import { env } from "./env.js";

export const prisma = createPrisma(env.DATABASE_URL);

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly client = prisma;
  async onModuleDestroy() {
    await prisma.$disconnect();
  }
}

@Global()
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}
