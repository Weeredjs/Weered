import type { KeyboardEvent } from "react";

/**
 * Keyboard activation for click-able non-button elements. Fires `fn` on Enter or
 * Space (with preventDefault), so a div/span that has an onClick can be made
 * keyboard-accessible without repeating the key-guard boilerplate at every call
 * site. Pairs with the element's onClick to satisfy WCAG / SonarQube S1082.
 *
 *   <div onClick={() => open()} onKeyDown={onActivate(() => open())} tabIndex={0} role="button" />
 */
export function onActivate<T = Element>(fn: (e: KeyboardEvent<T>) => void) {
  return (e: KeyboardEvent<T>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn(e);
    }
  };
}
