import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import App from "./App";

beforeEach(() => localStorage.clear());

describe("responsive navigation", () => {
  test("opens and closes the mobile drawer disclosure", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    const sidebar = screen.getByRole("complementary", {
      name: "Threads and prompt presets",
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(sidebar.className).toContain("sidebarOpen");

    await user.click(screen.getAllByRole("button", { name: "Close menu" })[0]);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("keeps the existing chat-focus close behavior", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trigger = screen.getByRole("button", { name: "Open menu" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "New thread" }));
    await user.click(screen.getByPlaceholderText("Type a message..."));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("collapses and restores the desktop sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const shell = container.firstElementChild as HTMLElement;

    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(shell.className).toContain("shellSidebarCollapsed");

    await user.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(shell.className).not.toContain("shellSidebarCollapsed");
  });

  test("resizes the desktop sidebar with the keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    const separator = screen.getByRole("separator", {
      name: "Resize sidebar",
    });

    expect(separator).toHaveAttribute("aria-valuenow", "300");
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "316");
    await user.keyboard("{Home}");
    expect(separator).toHaveAttribute("aria-valuenow", "240");
  });
});
