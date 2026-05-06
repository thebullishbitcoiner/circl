import { useState, useCallback } from "react";

export default function useWallet() {
  const [wallet, setWallet] = useState(() => {
    try {
      const s = localStorage.getItem("circl_wallet");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const saveWallet = useCallback(data => {
    setWallet(data);
    localStorage.setItem("circl_wallet", JSON.stringify(data));
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    localStorage.removeItem("circl_wallet");
  }, []);

  return { wallet, saveWallet, disconnect };
}
