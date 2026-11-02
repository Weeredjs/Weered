import type { KeyboardEvent } from "react";

/**
 * Keyboard activation for click-able non-button elements. Fires `fn` on Enter or
 * Space (with preventDefault), so a div/span that has an onClick can be made
 * keyboard-accessible without repeating the key-guard boilerplate at every call
 * site. Pairs with the element's onClick to satisfy WCAG / SonarQube S1082.
 *
 * Only a key pressed on the element itself counts. A pop-up's backdrop holds the
 * pop-up's whole form, so a space typed into its title reaches the backdrop too,
 * and used to close it (2026-11-01).
 *
 *   <div onClick={() => open()} onKeyDown={onActivate(() => open())} tabIndex={0} role="button" />
 */
export function onActivate<T = Element>(fn: (e: KeyboardEvent<T>) => void) {
  return (e: KeyboardEvent<T>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn(e);
    }
  };
}
