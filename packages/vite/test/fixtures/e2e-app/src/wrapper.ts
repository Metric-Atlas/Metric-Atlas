export function trackThroughWrapper(eventName: string): void {
  gtag("event", eventName, { wrapper: true });
}
