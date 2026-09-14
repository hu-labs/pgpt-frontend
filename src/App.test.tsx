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
});
