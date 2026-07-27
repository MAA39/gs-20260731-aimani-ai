export interface Clock {
  now(): Date;
}

export class HealthCheck {
  constructor(private readonly clock: Clock) {}

  execute() {
    this.clock.now();
    return { ok: true as const };
  }
}
