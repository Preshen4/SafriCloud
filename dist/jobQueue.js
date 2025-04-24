export class JobQueue {
    queue = [];
    activeCount = 0;
    tokens;
    lastRefillTime;
    disposed = false;
    concurrencyLimit;
    rateLimit;
    timeoutLimit;
    refillRate;
    constructor(options) {
        this.concurrencyLimit = options?.concurrencyLimit ?? 1000;
        this.rateLimit = options?.rateLimit ?? Infinity;
        this.timeoutLimit = options?.timeoutLimit ?? 1200;
        // Rate limiting setup
        this.tokens = this.rateLimit;
        this.refillRate = this.rateLimit / (60 * 1000); // tokens per ms
        this.lastRefillTime = Date.now();
    }
    schedule(fn, ...args) {
        if (this.disposed) {
            return Promise.reject(new Error('JobQueue has been disposed'));
        }
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
    size() {
        return this.queue.length;
    }
    active() {
        return this.activeCount;
    }
    dispose() {
        this.disposed = true;
        this.queue.forEach(job => {
            job.reject(new Error('JobQueue has been disposed'));
        });
        this.queue = [];
    }
    refillTokens() {
        const now = Date.now();
        const elapsed = now - this.lastRefillTime;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.rateLimit, this.tokens + tokensToAdd);
        this.lastRefillTime = now;
    }
    canRunJob() {
        if (this.disposed)
            return false;
        if (this.activeCount >= this.concurrencyLimit)
            return false;
        if (this.rateLimit === Infinity) {
            return true;
        }
        this.refillTokens();
        return this.tokens >= 1;
    }
    async processQueue() {
        if (!this.canRunJob() || this.queue.length === 0) {
            return;
        }
        const job = this.queue.shift();
        if (!job) {
            return;
        }
        // Consume one token for rate limiting
        if (this.rateLimit !== Infinity) {
            this.tokens -= 1;
        }
        this.activeCount++;
        const startTime = Date.now();
        const queueTime = startTime - job.enqueueTime;
        try {
            // Setup timeout if needed
            let timeoutId = null;
            let timeoutPromise = null;
            if (this.timeoutLimit !== Infinity) {
                timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error(`Job timed out after ${this.timeoutLimit} seconds`));
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
                executionTime
            });
        }
        catch (error) {
            job.reject(error);
        }
        finally {
            this.activeCount--;
            // Schedule next job processing
            setImmediate(() => this.processQueue());
            // If there are more jobs and we can't run them now,
            // set up a timer to check again after the rate limit period
            if (this.queue.length > 0 && this.rateLimit !== Infinity && this.tokens < 1) {
                const timeToNextToken = Math.ceil((1 - this.tokens) / this.refillRate);
                setTimeout(() => this.processQueue(), timeToNextToken);
            }
        }
    }
}
