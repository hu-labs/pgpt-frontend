/* Calculates viewport-safe placement for action menus anchored to sidebar controls. */

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

export type MenuPosition = {
  top: number;
  left: number;
  opensUpward: boolean;
};

export function calculateMenuPosition(
  anchor: Pick<DOMRect, "top" | "right" | "bottom">,
  menu: Pick<DOMRect, "width" | "height">,
  viewport: { width: number; height: number },
): MenuPosition {
  const availableBelow = viewport.height - anchor.bottom - VIEWPORT_MARGIN;

  // Open the menu upward if there is insufficient room below.
  const opensUpward = availableBelow < menu.height + MENU_GAP;

  const preferredTop = opensUpward
    ? anchor.top - menu.height - MENU_GAP
    : anchor.bottom + MENU_GAP;

  const maximumTop = Math.max(
    VIEWPORT_MARGIN,
    viewport.height - menu.height - VIEWPORT_MARGIN,
  );

  const maximumLeft = Math.max(
    VIEWPORT_MARGIN,
    viewport.width - menu.width - VIEWPORT_MARGIN,
  );

  return {
    top: Math.min(Math.max(preferredTop, VIEWPORT_MARGIN), maximumTop),
    left: Math.min(
      Math.max(anchor.right - menu.width, VIEWPORT_MARGIN),
      maximumLeft,
    ),
    opensUpward,
  };
}
