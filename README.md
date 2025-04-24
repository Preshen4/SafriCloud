# JobQueue

`JobQueue` is a TypeScript utility class that manages asynchronous jobs with built-in support for:

- Concurrency limiting
- Rate limiting (token bucket algorithm)
- Job timeout enforcement
- Graceful disposal of the queue

## Installation

```typescript
import { JobQueue } from './JobQueue';
```

## Constructor
```typescript
new JobQueue(options?: JobQueueOptions)
```
Creates a new instance of the JobQueue.

## Parameters

Parameter	Description	Default Value
concurrencyLimit	Maximum number of jobs to run concurrently	1000
rateLimit	Maximum number of jobs allowed per minute	Infinity
timeoutLimit	Timeout duration in seconds for each job	1200

## Example
```typescript
const queue = new JobQueue({
  concurrencyLimit: 5,
  rateLimit: 60,
  timeoutLimit: 10
});
##Methods
schedule()
```typescript
schedule(fn: (...args) => Promise<T>, ...args): Promise<JobResult<T>>

```
Schedules a job to be executed. Returns a promise that resolves when the job is complete.

Parameters
fn: An asynchronous function to execute

...args: Arguments to pass into the function

Returns
```typescript
{
  result: T;
  queueTime: number; // Time the job spent in the queue (ms)
  executionTime: number; // Time taken to execute the job (ms)
}
```
Example
```typescript
queue.schedule(async (name: string) => {
  await new Promise(res => setTimeout(res, 1000));
  return `Hello, ${name}`;
}, 'Alice').then(console.log).catch(console.error);
size()
```
```typescript
size(): number
```
Returns the number of jobs currently in the queue (pending execution).

Example
```typescript
console.log(`Queue size: ${queue.size()}`);
active()
```
```typescript
active(): number
```
Returns the number of jobs currently being processed.

Example
```typescript
console.log(`Active jobs: ${queue.active()}`);
dispose()
```
```typescript
dispose(): void
```
Disposes the queue. All pending jobs are rejected, and no new jobs can be scheduled.

Example
```typescript
queue.dispose();
Internal Logic (Advanced)
These methods are internal and not meant for public use

refillTokens(): Refills tokens based on elapsed time since last refill

canRunJob(): Checks whether the next job can run based on limits

processQueue(): Processes the next job in the queue if possible
```
## Example Use Case
```typescript
const jobQueue = new JobQueue({
  concurrencyLimit: 3,
  rateLimit: 10,
  timeoutLimit: 5
});

async function fetchData(id: number): Promise<string> {
  await new Promise(res => setTimeout(res, 1000));
  return `Fetched data for ID ${id}`;
}

// Schedule multiple jobs
for (let i = 0; i < 10; i++) {
  jobQueue.schedule(fetchData, i)
    .then(console.log)
    .catch(console.error);
}
```
## Notes
If a job exceeds the specified timeoutLimit, it is automatically rejected

Jobs are executed as soon as both:

Concurrency slots are available

Rate limit tokens are available

Once disposed, the queue cannot be reused or restarted

The queue processes jobs in FIFO (First-In-First-Out) order
