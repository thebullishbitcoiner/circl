import { useState } from "react";

export default function DomainFavicon({ domain, className }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) return null;
  return (
    <img
      className={className}
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
