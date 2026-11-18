import { useEffect } from "react";
import { PAYMENT_KEEPALIVE_MS, paymentBackend } from "@/lib/relworx";

/**
 * Pings the payments backend every few seconds while any page of the site is
 * open (signed in or not) so the backend never goes to sleep.
 */
export function PaymentKeepAlive() {
  useEffect(() => {
    let busy = false;
    const ping = () => {
      if (busy) return;
      busy = true;
      void fetch(`${paymentBackend()}/health`, { cache: "no-store", keepalive: true, mode: "no-cors" })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    };
    ping();
    const timer = window.setInterval(ping, PAYMENT_KEEPALIVE_MS);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
