"use client";

import React, { useState } from "react";

export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className,
  style,
  onCopy,
}: {
  value: string;
  label?: string | React.ReactNode;
  copiedLabel?: string | React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard?.writeText?.(value);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1400);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 1400);
      } catch {
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={style}
      aria-live="polite"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
