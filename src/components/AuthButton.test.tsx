import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { AuthUser } from "aws-amplify/auth";
import AuthButton from "./AuthButton";

const auth = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  listener: null as null | ((event: { payload: { event: string } }) => void),
}));

vi.mock("aws-amplify/auth", () => auth);
vi.mock("aws-amplify/utils", () => ({
  Hub: {
    listen: vi.fn((_channel: string, listener: typeof auth.listener) => {
      auth.listener = listener;
      return auth.unsubscribe;
    }),
  },
}));

const signedInUser: AuthUser = { userId: "user-1", username: "test-user" };

beforeEach(() => {
  vi.clearAllMocks();
  auth.listener = null;
  auth.getCurrentUser.mockRejectedValue(new Error("No session"));
  auth.signInWithRedirect.mockResolvedValue(undefined);
  auth.signOut.mockResolvedValue(undefined);
});

async function emit(event: string) {
  await act(async () => auth.listener?.({ payload: { event } }));
}

test("checks the session, shows Login, and starts Amplify's redirect", async () => {
  const user = userEvent.setup();
  render(<AuthButton />);
  expect(
    screen.getByRole("button", { name: "Checking login status" }),
  ).toBeDisabled();
  const login = await screen.findByRole("button", { name: "Login" });
  await user.click(login);
  expect(auth.signInWithRedirect).toHaveBeenCalledOnce();
});

test("restores an existing session, signs out, and unsubscribes on unmount", async () => {
  auth.getCurrentUser.mockResolvedValue(signedInUser);
  const user = userEvent.setup();
  const { unmount } = render(<AuthButton />);
  await user.click(await screen.findByRole("button", { name: "Logout" }));
  expect(auth.signOut).toHaveBeenCalledOnce();
  expect(await screen.findByRole("button", { name: "Login" })).toBeEnabled();
  unmount();
  expect(auth.unsubscribe).toHaveBeenCalledOnce();
});

test("updates the button on redirect, sign-in, refresh, and sign-out events", async () => {
  render(<AuthButton />);
  await screen.findByRole("button", { name: "Login" });
  for (const event of ["signedIn", "signInWithRedirect", "tokenRefresh"]) {
    auth.getCurrentUser.mockResolvedValue(signedInUser);
    await emit(event);
    expect(screen.getByRole("button", { name: "Logout" })).toBeEnabled();
    await emit("signedOut");
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  }
});

test("ignores a session check that completes after sign-out", async () => {
  let resolve!: (user: AuthUser) => void;
  auth.getCurrentUser.mockReturnValue(
    new Promise<AuthUser>((done) => {
      resolve = done;
    }),
  );
  render(<AuthButton />);
  await emit("signedOut");
  await act(async () => resolve(signedInUser));
  expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
});

test("reports redirect and action failures and allows retry", async () => {
  const user = userEvent.setup();
  auth.signInWithRedirect.mockRejectedValue(new Error("Failed"));
  render(<AuthButton />);
  await user.click(await screen.findByRole("button", { name: "Login" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Login could not be started",
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled(),
  );
  await emit("signInWithRedirect_failure");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Login could not be completed",
  );
});
