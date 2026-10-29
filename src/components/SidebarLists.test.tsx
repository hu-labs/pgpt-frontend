import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import type { Preset, Thread } from "../types";
import PresetList from "./PresetList";
import { calculateMenuPosition } from "./sidebarMenuPosition";
import ThreadList from "./ThreadList";

const thread = (title = "Original"): Thread => ({
  threadId: "550e8400-e29b-41d4-a716-446655440000",
  title,
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
});

const preset = (title = "Original preset"): Preset => ({
  presetId: "6d9c7c45-6cb3-4ced-b0cd-66ea532f32f2",
  title,
  text: "Saved text",
  createdAt: "2026-10-28T10:00:00.000Z",
  updatedAt: "2026-10-28T10:00:00.000Z",
});

describe("thread list", () => {
  test("portals actions outside the scrolling section", async () => {
    const user = userEvent.setup();
    render(
      <ThreadList
        threads={[thread()]}
        activeThreadIds={new Set()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Actions for Original",
    });

    await user.click(trigger);

    const menu = document.querySelector<HTMLElement>(
      "[data-sidebar-item-menu]",
    );

    expect(menu).toBeInTheDocument();
    expect(trigger.closest("section")).not.toContainElement(menu);
  });

  test("creates, selects, and renames a server-returned thread", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(thread("New conversation"));
    const onRename = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();

    function Harness() {
      const [threads, setThreads] = useState<Thread[]>([]);

      return (
        <ThreadList
          threads={threads}
          activeThreadIds={new Set()}
          onSelect={onSelect}
          onCreate={async () => {
            const created = await onCreate();
            setThreads([created]);

            return created;
          }}
          onRename={async (id, title) => {
            await onRename(id, title);
            setThreads((previous) =>
              previous.map((item) =>
                item.threadId === id ? { ...item, title } : item,
              ),
            );
          }}
          onDelete={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "New thread" }));
    expect(onSelect).toHaveBeenCalledWith(thread().threadId);

    const input = screen.getByDisplayValue("New conversation");
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard("My conversation{Enter}");
    await waitFor(() =>
      expect(onRename).toHaveBeenCalledWith(
        thread().threadId,
        "My conversation",
      ),
    );

    expect(input).toHaveValue("My conversation");
  });

  test("keeps failed operations visible and blocks deletion while streaming", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error("Failed"));
    render(
      <ThreadList
        threads={[thread()]}
        activeThreadIds={new Set([thread().threadId])}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Actions for Original" }),
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Original")).toBeInTheDocument();
  });
});

test("opens a sidebar item menu upward when space below is insufficient", () => {
  const position = calculateMenuPosition(
    { top: 440, right: 280, bottom: 480 },
    { width: 104, height: 80 },
    { width: 320, height: 500 },
  );

  expect(position).toMatchObject({ top: 356, left: 176, opensUpward: true });
});

describe("preset list", () => {
  test("creates API-backed presets only by click and appends saved text", async () => {
    const user = userEvent.setup();
    const onAppend = vi.fn();

    function Harness() {
      const [presets, setPresets] = useState<Preset[]>([]);

      return (
        <PresetList
          presets={presets}
          onAppend={onAppend}
          onCreate={async (title, text) => {
            const created = { ...preset(title), text };
            setPresets([created]);

            return created;
          }}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    }

    render(<Harness />);
    await user.type(screen.getByLabelText("Prompt title"), "Concise reply");
    await user.type(screen.getByLabelText("Prompt to save"), "Be concise.");
    await user.click(screen.getByRole("button", { name: "Add preset" }));
    await user.click(screen.getByDisplayValue("Concise reply"));
    expect(onAppend).toHaveBeenCalledWith("Be concise.");
  });

  test("renames and deletes through callbacks", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <PresetList
        presets={[preset()]}
        onAppend={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Actions for Original preset" }),
    );

    await user.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByDisplayValue("Original preset");
    await user.clear(input);
    await user.type(input, "Renamed preset{Enter}");
    expect(onUpdate).toHaveBeenCalledWith(preset().presetId, {
      title: "Renamed preset",
    });

    await user.click(
      screen.getByRole("button", { name: "Actions for Original preset" }),
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(preset().presetId);
  });
});
