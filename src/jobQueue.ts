import { JobQueueOptions, Job } from "./types";

export class JobQueue {
  private queue: Job<any>[] = []; // Queue to hold pending jobs
  private activeCount = 0; // Number of currently active jobs
  private disposed = false; // Flag to check if queue has been disposed

  private readonly concurrencyLimit: number; // Maximum concurrent jobs
  private readonly rateLimit: number; // Rate limit (jobs per minute)
  private readonly timeoutLimit: number; // Timeout per job in seconds

  private currentWindowStart: number = Date.now(); // Timestamp when the current 60s window started
  private jobsStartedInWindow = 0; // Count of jobs started in the current window

  constructor(options?: JobQueueOptions) {
    this.concurrencyLimit = options?.concurrencyLimit ?? 1000;
    this.rateLimit = options?.rateLimit ?? Infinity;
    this.timeoutLimit = options?.timeoutLimit ?? 1200;
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

  // Check if a job can be run
  private canRunJob(): boolean {
    if (this.disposed || this.activeCount >= this.concurrencyLimit)
      return false;

    const now = Date.now();

    // If 60 seconds have passed, reset the rate window
    if (now - this.currentWindowStart >= 60000) {
      // New time window
      this.currentWindowStart = now;
      this.jobsStartedInWindow = 0;
    }

    return this.rateLimit === Infinity || this.jobsStartedInWindow < this.rateLimit;
  }

  // Process jobs in the queue
  private async processQueue(): Promise<void> {
    // Process as many jobs as allowed under current constraints
    while (this.canRunJob() && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      this.jobsStartedInWindow++; // Track this job in current rate window
      this.activeCount++;
      const startTime = Date.now();
      const queueTime = startTime - job.enqueueTime;

      try {
        let timeoutId: NodeJS.Timeout | null = null;
        let timeoutPromise: Promise<never> | null = null;

        // Create a timeout promise if timeout limit is set
        if (this.timeoutLimit !== Infinity) {
          timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(
                new Error(`Job timed out after ${this.timeoutLimit} seconds`)
              );
            }, this.timeoutLimit * 1000);
          });
        }
        
        // Run the job with timeout enforcement if needed
        const result = await (timeoutPromise
          ? Promise.race([job.fn(...job.args), timeoutPromise])
          : job.fn(...job.args));

        if (timeoutId) clearTimeout(timeoutId);

        const executionTime = Date.now() - startTime;
        job.resolve({ result, queueTime, executionTime });
      } catch (error) {
        job.reject(error);
      } finally {
        this.activeCount--;

        // Let next jobs try to process
        setImmediate(() => this.processQueue());
      }
    }

    // If rate limit reached, retry after the window resets
    if (
      this.queue.length > 0 &&
      this.rateLimit !== Infinity &&
      this.jobsStartedInWindow >= this.rateLimit
    ) {
      const now = Date.now();
      const timeUntilNextWindow = this.currentWindowStart + 60000 - now;
      setTimeout(() => this.processQueue(), timeUntilNextWindow);
    }
  }
}
