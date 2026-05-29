import { useState, useEffect, useCallback, useRef } from "react";
import { NWCClient } from "@getalby/sdk/nwc";

export default function useWalletData(wallet) {
  const [balance,      setBalance]      = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const abortRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!wallet?.nwc_uri) return;
    abortRef.current = false;
    setLoading(true);
    setError(null);
    let client;
    try {
      client = new NWCClient({ nostrWalletConnectUrl: wallet.nwc_uri });
      const [balRes, txRes] = await Promise.all([
        client.getBalance(),
        client.listTransactions({ limit: 50 }).catch(() => ({ transactions: [] })),
      ]);
      if (abortRef.current) return;
      setBalance(balRes.balance);
      setTransactions(txRes.transactions ?? []);
    } catch (e) {
      if (!abortRef.current) setError(e.message || "Failed to load wallet");
    } finally {
      client?.close();
      if (!abortRef.current) setLoading(false);
    }
  }, [wallet?.nwc_uri]);

  useEffect(() => {
    abortRef.current = false;
    refresh();
    return () => { abortRef.current = true; };
  }, [refresh]);

  return { balance, transactions, loading, error, refresh };
}
