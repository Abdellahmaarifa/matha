import { useEffect } from "react";

// Lets the app shell tell the profile page "the user just tried to leave
// with an incomplete profile" without the two sharing state.
const EVENT = "matcha:profile-nudge";

export function nudgeIncompleteProfile() {
  window.dispatchEvent(new Event(EVENT));
}

export function useProfileNudge(onNudge: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, onNudge);
    return () => window.removeEventListener(EVENT, onNudge);
  }, [onNudge]);
}
