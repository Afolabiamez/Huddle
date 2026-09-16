import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  private started = false;
  private stopping = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.sweep();
    if (this.stopping) return;
    this.timer = setInterval(() => {
      void this.sweep();
    }, CLEANUP_INTERVAL_MS);
    // The maintenance timer must not keep an otherwise stopped process alive.
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // AuthModule is destroyed before the global PrismaModule, so the current
    // query finishes before PrismaService disconnects its connection pool.
    await this.inFlight;
  }

  private sweep(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.deleteExpiredSessions().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async deleteExpiredSessions(): Promise<void> {
    try {
      await this.prisma.authSession.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
    } catch {
      // Driver errors can contain connection details. A failed sweep must not
      // expose them or stop authentication; expired rows already fail validation.
      this.logger.warn(
        'Expired session cleanup failed. It will retry on the next hourly sweep.',
      );
    }
  }
}
