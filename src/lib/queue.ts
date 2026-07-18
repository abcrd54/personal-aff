type QueueTask<T> = () => Promise<T>;

interface QueueEntry<T> {
  task: QueueTask<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ConcurrencyQueue {
  private queue: QueueEntry<any>[] = [];
  private running = 0;

  constructor(
    private maxConcurrency: number,
    private queueTimeoutMs: number,
    private maxQueueSize: number = 100
  ) {}

  async enqueue<T>(task: QueueTask<T>): Promise<T> {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error("Queue full — too many pending requests. Try again later.");
    }

    if (this.running < this.maxConcurrency) {
      this.running++;
      try {
        return await task();
      } finally {
        this.running--;
        this.processNext();
      }
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((e) => e.resolve === resolve && e.reject === reject);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new Error("Queue timeout: request waited too long"));
      }, this.queueTimeoutMs);

      this.queue.push({ task, resolve, reject, timer });
    });
  }

  private processNext() {
    if (this.queue.length === 0 || this.running >= this.maxConcurrency) return;

    const next = this.queue.shift()!;
    clearTimeout(next.timer);
    this.running++;

    (async () => {
      try {
        const result = await next.task();
        next.resolve(result);
      } catch (e) {
        next.reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        this.running--;
        this.processNext();
      }
    })();
  }

  status() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      availableSlots: this.maxConcurrency - this.running,
    };
  }
}
