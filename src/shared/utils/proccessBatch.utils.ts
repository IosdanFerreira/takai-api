export async function processBatch(
  items: any[],
  fn: (item: any) => Promise<void>,
  concurrency = 10,
) {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
  }
}
