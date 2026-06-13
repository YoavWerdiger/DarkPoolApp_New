/**
 * hooks/useBrokerPortfolio.ts
 * --------------------------------------------------------------------------
 * הוק שמספק לתיק נתוני broker עדכניים:
 *   - summary (state + connection status)
 *   - positions פתוחות
 *   - open orders
 *   - sync action
 *
 * משתמש ב-Supabase realtime כדי לעדכן את הקליינט בזמן אמת בכל פעם
 * שהסנכרון מצד השרת מעדכן את הטבלאות.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  getBrokerAccountByPortfolio,
  getBrokerAccountState,
  getBrokerPortfolioSummary,
  listBrokerOpenOrders,
  listBrokerPositions,
  syncBrokerNow,
} from '../services/brokers/brokerService';
import type {
  BrokerAccount,
  BrokerAccountState,
  BrokerOpenOrder,
  BrokerPortfolioSummary,
  BrokerPosition,
} from '../services/brokers/types';

interface UseBrokerPortfolioResult {
  brokerAccount: BrokerAccount | null;
  summary: BrokerPortfolioSummary | null;
  state: BrokerAccountState | null;
  positions: BrokerPosition[];
  openOrders: BrokerOpenOrder[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** טוען מחדש את כל הנתונים מ-DB (לא מבקש sync מהshield). */
  reload: () => Promise<void>;
  /** מפעיל syncBrokerNow ומוודא שהנתונים מתעדכנים. */
  syncNow: (opts?: { full?: boolean }) => Promise<void>;
}

export function useBrokerPortfolio(portfolioId: string | null | undefined): UseBrokerPortfolioResult {
  const [brokerAccount, setBrokerAccount] = useState<BrokerAccount | null>(null);
  const [summary, setSummary] = useState<BrokerPortfolioSummary | null>(null);
  const [state, setState] = useState<BrokerAccountState | null>(null);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [openOrders, setOpenOrders] = useState<BrokerOpenOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    setError(null);
    try {
      const acc = await getBrokerAccountByPortfolio(portfolioId);
      setBrokerAccount(acc);
      if (!acc) {
        setSummary(null);
        setState(null);
        setPositions([]);
        setOpenOrders([]);
        return;
      }
      const [s, st, pos, ord] = await Promise.all([
        getBrokerPortfolioSummary(portfolioId),
        getBrokerAccountState(acc.id),
        listBrokerPositions(acc.id),
        listBrokerOpenOrders(acc.id),
      ]);
      setSummary(s);
      setState(st);
      setPositions(pos);
      setOpenOrders(ord);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [portfolioId]);

  // initial load
  useEffect(() => {
    if (!portfolioId) return;
    let alive = true;
    setLoading(true);
    void reload().finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [portfolioId, reload]);

  // realtime subscriptions – רק לאחר שיש broker_account_id
  useEffect(() => {
    if (!brokerAccount?.id) return;

    const channel = supabase
      .channel(`broker-portfolio:${brokerAccount.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_account_state',
          filter: `broker_account_id=eq.${brokerAccount.id}`,
        },
        () => {
          void getBrokerAccountState(brokerAccount.id).then(setState);
          void getBrokerPortfolioSummary(brokerAccount.portfolio_id ?? '').then((s) => {
            if (s) setSummary(s);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_positions',
          filter: `broker_account_id=eq.${brokerAccount.id}`,
        },
        () => {
          void listBrokerPositions(brokerAccount.id).then(setPositions);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broker_open_orders',
          filter: `broker_account_id=eq.${brokerAccount.id}`,
        },
        () => {
          void listBrokerOpenOrders(brokerAccount.id).then(setOpenOrders);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [brokerAccount?.id, brokerAccount?.portfolio_id]);

  const syncNow = useCallback(
    async (opts: { full?: boolean } = {}) => {
      if (!summary?.broker_account_id) return;
      setRefreshing(true);
      setError(null);
      try {
        // צריך connection_id דרך broker_account
        const acc = brokerAccount ?? (await getBrokerAccountByPortfolio(portfolioId ?? ''));
        if (!acc) throw new Error('no_broker_account');
        await syncBrokerNow(acc.connection_id, { full: opts.full });
        await reload();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setRefreshing(false);
      }
    },
    [brokerAccount, portfolioId, reload, summary?.broker_account_id]
  );

  return useMemo(
    () => ({
      brokerAccount,
      summary,
      state,
      positions,
      openOrders,
      loading,
      refreshing,
      error,
      reload,
      syncNow,
    }),
    [
      brokerAccount,
      summary,
      state,
      positions,
      openOrders,
      loading,
      refreshing,
      error,
      reload,
      syncNow,
    ]
  );
}
