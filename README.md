\# JobQueue

\`JobQueue\` is a TypeScript utility class that manages asynchronous jobs with built-in support for:

\- Concurrency limiting

\- Rate limiting (token bucket algorithm)

\- Job timeout enforcement

\- Graceful disposal of the queue

\---

\## Installation

Simply import the class into your project:

\`\`\`ts

import { JobQueue } from './JobQueue';

Constructor

new JobQueue(options?: JobQueueOptions)

Creates a new instance of the JobQueue.

Parameters:

concurrencyLimit (optional): Maximum number of jobs to run concurrently. Default is 1000.

rateLimit (optional): Maximum number of jobs allowed per minute. Default is Infinity (no limit).

timeoutLimit (optional): Timeout duration in seconds for each job. Default is 1200 seconds.

Example:

ts

Copy

Edit

const queue = new JobQueue({

concurrencyLimit: 5,

rateLimit: 60,

timeoutLimit: 10

});

Methods

schedule(fn: (...args) => Promise, ...args): Promise

Schedules a job to be executed. Returns a promise that resolves when the job is complete.

Parameters:

fn: An asynchronous function to execute.

...args: Arguments to pass into the function.

Returns:

A Promise that resolves to an object:

ts

Copy

Edit

{

result: T;

queueTime: number; // Time the job spent in the queue (ms)

executionTime: number; // Time taken to execute the job (ms)

}

Example:

ts

Copy

Edit

queue.schedule(async (name: string) => {

await new Promise(res => setTimeout(res, 1000));

return \`Hello, ${name}\`;

}, 'Alice').then(console.log).catch(console.error);

size(): number

Returns the number of jobs currently in the queue (pending execution).

Example:

ts

Copy

Edit

console.log(\`Queue size: ${queue.size()}\`);

active(): number

Returns the number of jobs currently being processed.

Example:

ts

Copy

Edit

console.log(\`Active jobs: ${queue.active()}\`);

dispose(): void

Disposes the queue. All pending jobs are rejected, and no new jobs can be scheduled.

Example:

ts

Copy

Edit

queue.dispose();

Internal Logic (Advanced)

These methods are internal and not meant for public use, but are useful for understanding how the queue works:

refillTokens(): Refills tokens based on elapsed time since last refill.

canRunJob(): Checks whether the next job can run based on limits.

processQueue(): Processes the next job in the queue if possible.

Example Use Case

ts

Copy

Edit

const jobQueue = new JobQueue({

concurrencyLimit: 3,

rateLimit: 10,

timeoutLimit: 5

});

async function fetchData(id: number): Promise {

await new Promise(res => setTimeout(res, 1000));

return \`Fetched data for ID ${id}\`;

}

// Schedule multiple jobs

for (let i = 0; i < 10; i++) {

jobQueue.schedule(fetchData, i).then(console.log).catch(console.error);

}

Notes

If a job exceeds the specified timeoutLimit, it is automatically rejected.

Jobs are executed as soon as both concurrency slots and tokens are available.

Once disposed, the queue cannot be reused or restarted.