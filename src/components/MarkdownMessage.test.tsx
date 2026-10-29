import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import MarkdownMessage from "./MarkdownMessage";

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe("MarkdownMessage", () => {
  test("renders GFM tables", () => {
    render(<MarkdownMessage content={"| A | B |\n| - | - |\n| 1 | 2 |"} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  test("renders inline code without a code-block wrapper", () => {
    render(<MarkdownMessage content="use `inline()` here" />);
    expect(screen.getByText("inline()").tagName).toBe("CODE");
    expect(
      screen.queryByRole("button", { name: "Copy" }),
    ).not.toBeInTheDocument();
  });

  test("renders fenced code blocks with a language label and a working copy button", async () => {
    // userEvent.setup() installs its own clipboard stub, so mock after it runs.
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    const code = "console.log('hi')";
    render(<MarkdownMessage content={`\`\`\`js\n${code}\n\`\`\``} />);

    expect(screen.getByText("js")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code);
  });

  test("opens links safely in a new tab", () => {
    render(<MarkdownMessage content="[site](https://example.com)" />);
    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
