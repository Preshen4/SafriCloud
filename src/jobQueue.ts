import { JobQueueOptions, Job } from "./types";

export class JobQueue {
  private queue: Job<any>[] = []; // Queue to hold pending jobs
  private activeCount = 0; // Number of currently active jobs
  private tokens: number; // Rate-limiting token bucket
  private lastRefillTime: number; // Last time tokens were refilled
  private disposed = false; // Flag to check if queue has been disposed
  private readonly concurrencyLimit: number; // Maximum concurrent jobs
  private readonly rateLimit: number; // Rate limit (jobs per minute)
  private readonly timeoutLimit: number; // Timeout per job in seconds
  private readonly refillRate: number; // Rate of token refill per ms

  constructor(options?: JobQueueOptions) {
    this.concurrencyLimit = options?.concurrencyLimit ?? 1000;
    this.rateLimit = options?.rateLimit ?? Infinity;
    this.timeoutLimit = options?.timeoutLimit ?? 1200;

    // Rate limiting setup
    this.tokens = this.rateLimit;
    this.refillRate = this.rateLimit / (60 * 1000); // tokens per ms
    this.lastRefillTime = Date.now();
  }

  // Schedule a job to be executed
  schedule<T>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> {
    if (this.disposed)
      return Promise.reject(new Error("JobQueue has been disposed"));

    return new Promise<T>((resolve, reject) => {
      const job: Job<T> = {
        fn,
        args,
        resolve,
        reject,
        enqueueTime: Date.now(),
      };

      this.queue.push(job);
      this.processQueue();
    });
  }

  // Get number of jobs in queue
  size(): number {
    return this.queue.length;
  }

  // Get number of active jobs
  active(): number {
    return this.activeCount;
  }

  // Dispose the queue and reject all pending jobs
  dispose(): void {
    this.disposed = true;
    this.queue.forEach((job) => {
      job.reject(new Error("JobQueue has been disposed"));
    });
    this.queue = [];
  }

  // Refill tokens based on elapsed time
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.rateLimit, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  // Check if a job can be run
  private canRunJob(): boolean {
    if (this.disposed || this.activeCount >= this.concurrencyLimit)
      return false;

    if (this.rateLimit === Infinity) return true;

    this.refillTokens();
    return this.tokens >= 1;
  }

  // Process jobs in the queue
  private async processQueue(): Promise<void> {
    if (!this.canRunJob() || this.queue.length === 0) return;

    const job = this.queue.shift();
    if (!job) return;

    // Consume one token for rate limiting
    if (this.rateLimit !== Infinity) this.tokens -= 1;

    this.activeCount++;
    const startTime = Date.now();
    const queueTime = startTime - job.enqueueTime;

    try {
      let timeoutId: NodeJS.Timeout | null = null;
      let timeoutPromise: Promise<never> | null = null;

      if (this.timeoutLimit !== Infinity) {
        timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(`Job timed out after ${this.timeoutLimit} seconds`)
            );
          }, this.timeoutLimit * 1000);
        });
      }

      // Execute the job with potential timeout
      const result = await (timeoutPromise
        ? Promise.race([job.fn(...job.args), timeoutPromise])
        : job.fn(...job.args));

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const executionTime = Date.now() - startTime;
      job.resolve({
        result,
        queueTime,
        executionTime,
      });
    } catch (error) {
      job.reject(error);
    } finally {
      this.activeCount--;

      // Schedule next job processing
      setImmediate(() => this.processQueue());

      if (
        this.queue.length > 0 &&
        this.rateLimit !== Infinity &&
        this.tokens < 1
      ) {
        const timeToNextToken = Math.ceil((1 - this.tokens) / this.refillRate);
        setTimeout(() => this.processQueue(), timeToNextToken);
      }
    }
  }
}
