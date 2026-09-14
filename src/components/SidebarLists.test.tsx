import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { load, save } from "../lib/storage";
import PresetList from "./PresetList";
import ThreadList from "./ThreadList";

beforeEach(() => localStorage.clear());

describe("sidebar list behavior", () => {
  test("creates and selects a thread", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ThreadList onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "New thread" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue("New chat")).toBeInTheDocument();
    expect(load().threads).toHaveLength(1);
  });

  test("preserves thread rename, Escape, outside-click, and delete behavior", async () => {
    const user = userEvent.setup();
    save({
      threads: [{ id: "t1", title: "Original", createdAt: 1, updatedAt: 1 }],
      messages: [
        {
          id: "m1",
          threadId: "t1",
          role: "user",
          content: "Hello",
          createdAt: 1,
        },
      ],
      presets: [],
    });
    render(<ThreadList onSelect={vi.fn()} />);

    const input = screen.getByDisplayValue("Original");
    const actions = screen.getByRole("button", {
      name: "Actions for Original",
    });
    await user.click(actions);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.clear(input);
    await user.type(input, "Discarded");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("Original");
    expect(load().threads[0].title).toBe("Original");

    await user.click(actions);
    expect(screen.getByText("Delete")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();

    await user.click(actions);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.clear(input);
    await user.type(input, "Renamed");
    await user.tab();
    expect(load().threads[0].title).toBe("Renamed");

    await user.click(
      screen.getByRole("button", { name: "Actions for Renamed" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(load().threads).toHaveLength(0);
    expect(load().messages).toHaveLength(0);
  });

  test("creates presets only by click and appends their saved text", async () => {
    const user = userEvent.setup();
    const onAppend = vi.fn();
    render(<PresetList onAppend={onAppend} />);

    await user.type(screen.getByLabelText("Prompt title"), "Concise reply");
    await user.keyboard("{Enter}");
    expect(load().presets).toHaveLength(0);

    await user.type(screen.getByLabelText("Prompt to save"), "Be concise.");
    await user.click(screen.getByRole("button", { name: "Add preset" }));
    expect(load().presets).toHaveLength(1);

    await user.click(screen.getByDisplayValue("Concise reply"));
    expect(onAppend).toHaveBeenCalledWith("Be concise.");
  });

  test("preserves preset rename and delete behavior", async () => {
    const user = userEvent.setup();
    save({
      threads: [],
      messages: [],
      presets: [
        {
          id: "p1",
          title: "Original preset",
          text: "Saved text",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    render(<PresetList onAppend={vi.fn()} />);

    const input = screen.getByDisplayValue("Original preset");
    await user.click(
      screen.getByRole("button", { name: "Actions for Original preset" }),
    );
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.clear(input);
    await user.type(input, "Renamed preset");
    await user.tab();
    expect(load().presets[0].title).toBe("Renamed preset");

    await user.click(
      screen.getByRole("button", { name: "Actions for Renamed preset" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(load().presets).toHaveLength(0);
  });
});
