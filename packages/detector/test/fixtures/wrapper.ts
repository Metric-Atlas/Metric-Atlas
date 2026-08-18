import ReactGA from "react-ga4";

export function trackEvent(name: string, parameters: object): void {
  gtag("event", name, parameters);
  void ReactGA;
}
