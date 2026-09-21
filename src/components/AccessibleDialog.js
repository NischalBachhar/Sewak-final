import React, { useEffect, useId, useRef } from "react";

export default function AccessibleDialog({ children, onDismiss, ...props }) {
  const ref = useRef(null);
  const headingId = useId();
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const heading = dialog.querySelector("h1,h2,h3,h4");
    if (heading) { heading.id ||= headingId; dialog.setAttribute("aria-labelledby", heading.id); }
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [...dialog.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')].filter((element) => !element.disabled && !element.hidden && element.getAttribute("aria-hidden") !== "true");
    (focusable()[0] || dialog).focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); dismissRef.current?.(); }
      if (event.key === "Tab") {
        const elements = focusable(); const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const containFocus = (event) => { if (!dialog.contains(event.target)) (focusable()[0] || dialog).focus(); };
    dialog.addEventListener("keydown", keydown);
    document.addEventListener("focusin", containFocus);
    return () => {
      dialog.removeEventListener("keydown", keydown); document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = priorOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [headingId]);
  return <div {...props} ref={ref} role="dialog" aria-modal="true" aria-label={props["aria-label"] || "Dialog"} tabIndex={-1}>{children}</div>;
}
