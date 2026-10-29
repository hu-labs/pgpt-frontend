/* Renders sidebar item actions in a body-level portal so scrolling list boundaries cannot clip them. */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  calculateMenuPosition,
  type MenuPosition,
} from "./sidebarMenuPosition";
import styles from "./SidebarList.module.css";

interface SidebarItemMenuProps {
  id: string;
  anchor: HTMLButtonElement | null;
  label: string;
  onDismiss: () => void;
  children: ReactNode;
}

export default function SidebarItemMenu({
  id,
  anchor,
  label,
  onDismiss,
  children,
}: SidebarItemMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const positionMenu = () => {
      setPosition(
        calculateMenuPosition(
          anchor.getBoundingClientRect(),
          menu.getBoundingClientRect(),
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
    };

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(positionMenu);

    resizeObserver?.observe(anchor);
    resizeObserver?.observe(menu);

    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      resizeObserver?.disconnect();
    };
  }, [anchor]);

  useEffect(() => {
    const dismissFromOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return;

      onDismiss();
    };

    const dismissFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
        anchor?.focus();
      }
    };

    document.addEventListener("mousedown", dismissFromOutside);
    document.addEventListener("keydown", dismissFromKeyboard);

    return () => {
      document.removeEventListener("mousedown", dismissFromOutside);
      document.removeEventListener("keydown", dismissFromKeyboard);
    };
  }, [anchor, onDismiss]);

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className={styles.actionsPanel}
      aria-label={label}
      data-sidebar-item-menu=""
      data-placement={position?.opensUpward ? "top" : "bottom"}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
