export interface JobQueueOptions {
    concurrencyLimit?: number;
    rateLimit?: number; 
    timeoutLimit?: number; 
}

export interface Job<T> {
    fn: (...args: any[]) => Promise<T>;
    args: any[];
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    enqueueTime: number;
}