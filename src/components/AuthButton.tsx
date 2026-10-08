import { useEffect, useState } from "react";
import {
  getCurrentUser,
  signInWithRedirect,
  signOut,
  type AuthUser,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import controls from "./Controls.module.css";
import styles from "./AuthButton.module.css";

export default function AuthButton() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let revision = 0;

    async function refreshUser() {
      const currentRevision = ++revision;
      let currentUser: AuthUser | null = null;
      try {
        currentUser = await getCurrentUser();
      } catch {
        // No authenticated session is the normal initial logged-out state.
      }
      // A late session check must not undo a newer sign-out or update after unmount.
      if (active && currentRevision === revision) {
        setUser(currentUser);
        setIsLoading(false);
      }
    }

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
        case "tokenRefresh":
          setError(null);
          void refreshUser();
          break;
        case "signedOut":
          revision++;
          setUser(null);
          setIsLoading(false);
          setIsBusy(false);
          break;
        case "signInWithRedirect_failure":
          setError("Login could not be completed. Please try again.");
          setIsLoading(false);
          setIsBusy(false);
          break;
      }
    });
    void refreshUser();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleClick() {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      if (user) {
        await signOut();
        setUser(null);
      } else {
        // Amplify builds the authorization URL and manages PKCE and the callback.
        await signInWithRedirect();
      }
    } catch {
      setError(
        user
          ? "Logout could not be completed. Please try again."
          : "Login could not be started. Please try again.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className={styles.authControl}>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button
        type="button"
        className={`${controls.button} ${controls.primary}`}
        disabled={isLoading || isBusy}
        aria-busy={isLoading || isBusy}
        aria-label={isLoading ? "Checking login status" : undefined}
        onClick={() => void handleClick()}
      >
        {isLoading ? "…" : user ? "Logout" : "Login"}
      </button>
    </div>
  );
}
