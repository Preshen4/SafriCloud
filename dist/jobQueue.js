export class JobQueue {
    queue = []; // Queue to hold pending jobs
    activeCount = 0; // Number of currently active jobs
    disposed = false; // Flag to check if queue has been disposed
    concurrencyLimit; // Maximum concurrent jobs
    rateLimit; // Rate limit (jobs per minute)
    timeoutLimit; // Timeout per job in seconds
    currentWindowStart = Date.now();
    jobsStartedInWindow = 0;
    constructor(options) {
        this.concurrencyLimit = options?.concurrencyLimit ?? 1000;
        this.rateLimit = options?.rateLimit ?? Infinity;
        this.timeoutLimit = options?.timeoutLimit ?? 1200;
    }
    // Schedule a job to be executed
    schedule(fn, ...args) {
        if (this.disposed)
            return Promise.reject(new Error("JobQueue has been disposed"));
        return new Promise((resolve, reject) => {
            const job = {
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
    size() {
        return this.queue.length;
    }
    // Get number of active jobs
    active() {
        return this.activeCount;
    }
    // Dispose the queue and reject all pending jobs
    dispose() {
        this.disposed = true;
        this.queue.forEach((job) => {
            job.reject(new Error("JobQueue has been disposed"));
        });
        this.queue = [];
    }
    // Check if a job can be run
    canRunJob() {
        if (this.disposed || this.activeCount >= this.concurrencyLimit)
            return false;
        const now = Date.now();
        if (now - this.currentWindowStart >= 60000) {
            // New time window
            this.currentWindowStart = now;
            this.jobsStartedInWindow = 0;
        }
        return this.rateLimit === Infinity || this.jobsStartedInWindow < this.rateLimit;
    }
    // Process jobs in the queue
    async processQueue() {
        while (this.canRunJob() && this.queue.length > 0) {
            const job = this.queue.shift();
            if (!job)
                continue;
            this.jobsStartedInWindow++;
            this.activeCount++;
            const startTime = Date.now();
            const queueTime = startTime - job.enqueueTime;
            try {
                let timeoutId = null;
                let timeoutPromise = null;
                if (this.timeoutLimit !== Infinity) {
                    timeoutPromise = new Promise((_, reject) => {
                        timeoutId = setTimeout(() => {
                            reject(new Error(`Job timed out after ${this.timeoutLimit} seconds`));
                        }, this.timeoutLimit * 1000);
                    });
                }
                const result = await (timeoutPromise
                    ? Promise.race([job.fn(...job.args), timeoutPromise])
                    : job.fn(...job.args));
                if (timeoutId)
                    clearTimeout(timeoutId);
                const executionTime = Date.now() - startTime;
                job.resolve({ result, queueTime, executionTime });
            }
            catch (error) {
                job.reject(error);
            }
            finally {
                this.activeCount--;
                // Let next jobs try to process
                setImmediate(() => this.processQueue());
            }
        }
        // If rate limit reached, retry after the window resets
        if (this.queue.length > 0 &&
            this.rateLimit !== Infinity &&
            this.jobsStartedInWindow >= this.rateLimit) {
            const now = Date.now();
            const timeUntilNextWindow = this.currentWindowStart + 60000 - now;
            setTimeout(() => this.processQueue(), timeUntilNextWindow);
        }
    }
}
