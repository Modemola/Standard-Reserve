"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Briefly lifts a readout to gold when its value changes.
 *
 * Deliberately does not tween the digits. This is a precision instrument —
 * every figure comes from exact bigint maths, so showing interpolated
 * intermediate numbers would be showing figures the engine never produced.
 * The text is always exact; only the highlight moves.
 *
 * Never fires on first mount, which also keeps it clear of the e2e tests
 * that read these values immediately after navigation.
 */
export function FlashOnChange({
  value,
  children,
  className = "",
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const previous = useRef<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  useEffect(() => {
    if (previous.current !== null && previous.current !== value) {
      setFlashKey((k) => k + 1);
    }
    previous.current = value;
  }, [value]);

  return (
    <span key={flashKey} className={`${flashKey > 0 ? "value-flash" : ""} ${className}`}>
      {children}
    </span>
  );
}
