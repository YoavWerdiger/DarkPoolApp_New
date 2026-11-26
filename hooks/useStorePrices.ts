import { useEffect, useState } from 'react';
import { IAP_ENABLED } from '../lib/iapProducts';
import { loadStorePrices, type StorePrice } from '../services/iapService';

/** מחירים מקומיים מהחנות (מובייל בלבד). בווב / לפני טעינה — אובייקט ריק. */
export function useStorePrices(): Record<string, StorePrice> {
  const [prices, setPrices] = useState<Record<string, StorePrice>>({});
  useEffect(() => {
    if (!IAP_ENABLED) return;
    let alive = true;
    void loadStorePrices().then((p) => {
      if (alive) setPrices(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return prices;
}
