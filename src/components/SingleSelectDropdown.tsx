import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./SingleSelectDropdown.css";

export interface SingleSelectOption {
  value: string;
  label: string;
}

interface SingleSelectDropdownProps {
  value: string;
  options: SingleSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  menuPlacement?: "down" | "up";
  menuWidth?: number;
  menuMaxHeight?: number;
}

export function SingleSelectDropdown({
  value,
  options,
  onChange,
  className,
  menuClassName,
  disabled = false,
  ariaLabel,
  placeholder,
  menuPlacement = "down",
  menuWidth,
  menuMaxHeight = 280,
}: SingleSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const updateMenuPosition = (event?: Event) => {
      const eventTarget = event?.target;
      if (
        event?.type === "scroll" &&
        eventTarget instanceof Node &&
        menuRef.current?.contains(eventTarget)
      ) {
        return;
      }
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = menuWidth ? Math.max(rect.width, menuWidth) : rect.width;
      const left = Math.min(
        rect.left,
        Math.max(12, window.innerWidth - width - 12),
      );
      const nextStyle =
        menuPlacement === "up"
          ? {
              bottom: Math.round(window.innerHeight - rect.top + 10),
              left: Math.round(left),
              width: Math.round(width),
              maxHeight: Math.min(menuMaxHeight, Math.max(160, rect.top - 20)),
            }
          : {
              top: Math.round(rect.bottom + 10),
              left: Math.round(left),
              width: Math.round(width),
              maxHeight: Math.min(
                menuMaxHeight,
                Math.max(160, window.innerHeight - rect.bottom - 20),
              ),
            };
      setMenuStyle((prev) =>
        prev &&
        prev.top === nextStyle.top &&
        prev.bottom === nextStyle.bottom &&
        prev.left === nextStyle.left &&
        prev.width === nextStyle.width &&
        prev.maxHeight === nextStyle.maxHeight
          ? prev
          : nextStyle,
      );
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    updateMenuPosition();
    // 延迟绑定，避免与打开触发器同一次 pointer/click 立刻关掉菜单。
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointerDown);
    }, 0);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuMaxHeight, menuPlacement, menuWidth, open]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
  }, [disabled]);

  const currentLabel = selectedOption?.label ?? placeholder ?? "";

  return (
    <div
      ref={rootRef}
      className={[
        "single-select-dropdown",
        disabled ? "disabled" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`single-select-dropdown-trigger${open ? " open" : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
      >
        <span className="single-select-dropdown-value" title={currentLabel}>
          {currentLabel}
        </span>
        <span className="single-select-dropdown-arrow">
          <ChevronDown size={16} />
        </span>
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              className={[
                "single-select-dropdown-menu",
                menuClassName ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                position: "fixed",
                top: menuStyle.top !== undefined ? `${menuStyle.top}px` : "auto",
                bottom: menuStyle.bottom !== undefined ? `${menuStyle.bottom}px` : "auto",
                left: `${menuStyle.left}px`,
                width: `${menuStyle.width}px`,
                maxHeight: `${menuStyle.maxHeight}px`,
                zIndex: 11000,
              }}
              role="listbox"
              aria-label={ariaLabel}
            >
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`single-select-dropdown-item${active ? " active" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={active}
                  >
                    <span
                      className="single-select-dropdown-item-label"
                      title={option.label}
                    >
                      {option.label}
                    </span>
                    <span className="single-select-dropdown-item-check">
                      {active ? <Check size={15} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
