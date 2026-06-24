import { useState, useEffect, useCallback, useRef } from "react";
import { NWCClient } from "@getalby/sdk/nwc";

const PAGE_SIZE = 25;

function computeFlow(txns) {
  const satsIn   = txns.filter(tx => tx.type === "incoming").reduce((s, tx) => s + Math.round((tx.amount    ?? 0) / 1000), 0);
  const satsOut  = txns.filter(tx => tx.type === "outgoing").reduce((s, tx) => s + Math.round((tx.amount    ?? 0) / 1000), 0);
  const feesPaid = txns.filter(tx => tx.type === "outgoing").reduce((s, tx) => s + Math.round((tx.fees_paid ?? 0) / 1000), 0);
  return { satsIn, satsOut, feesPaid, net: satsIn - satsOut };
}

export default function useWalletData(wallet) {
  const [balance,      setBalance]      = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [flow24h,      setFlow24h]      = useState({ satsIn: 0, satsOut: 0, feesPaid: 0, net: 0 });
  const [hasMore,      setHasMore]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [error,        setError]        = useState(null);
  const offsetRef = useRef(0);
  const abortRef  = useRef(false);

  const refresh = useCallback(async () => {
    if (!wallet?.nwc_uri) return;
    abortRef.current = false;
    setLoading(true);
    setError(null);
    setHasMore(false);
    let client;
    try {
      client = new NWCClient({ nostrWalletConnectUrl: wallet.nwc_uri });
      const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
      const [balRes, txRes, flowRes] = await Promise.all([
        client.getBalance(),
        client.listTransactions({ limit: PAGE_SIZE, offset: 0 }),
        client.listTransactions({ from: oneDayAgo, limit: 500 }).catch(() => ({ transactions: [] })),
      ]);
      if (abortRef.current) return;
      setBalance(balRes.balance);
      const txns = txRes.transactions ?? [];
      offsetRef.current = txns.length;
      setTransactions(txns);
      setHasMore(txns.length === PAGE_SIZE);
      const settled24h = (flowRes.transactions ?? []).filter(tx => tx.state === "settled");
      setFlow24h(computeFlow(settled24h));
    } catch (e) {
      if (!abortRef.current) setError(e.message || "Failed to load wallet");
    } finally {
      client?.close();
      if (!abortRef.current) setLoading(false);
    }
  }, [wallet?.nwc_uri]);

  const loadMore = useCallback(async () => {
    if (!wallet?.nwc_uri || loadingMore || !hasMore) return;
    setLoadingMore(true);
    let client;
    try {
      client = new NWCClient({ nostrWalletConnectUrl: wallet.nwc_uri });
      const res = await client.listTransactions({ limit: PAGE_SIZE, offset: offsetRef.current });
      if (abortRef.current) return;
      const newTxns = res.transactions ?? [];
      setTransactions(prev => [...prev, ...newTxns]);
      setHasMore(newTxns.length === PAGE_SIZE);
      offsetRef.current += newTxns.length;
    } catch {
      // silently ignore load-more failures; user can scroll again to retry
    } finally {
      client?.close();
      if (!abortRef.current) setLoadingMore(false);
    }
  }, [wallet?.nwc_uri, loadingMore, hasMore]);

  useEffect(() => {
    abortRef.current = false;
    refresh();
    return () => { abortRef.current = true; };
  }, [refresh]);

  return { balance, transactions, flow24h, hasMore, loadMore, loadingMore, loading, error, refresh };
}
