import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  safePolygon,
  shift,
  size,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import clsx from "clsx";
import { createContext, type ReactNode, use, useEffect, useState } from "react";

const PopoverContext = createContext<(() => void) | null>(null);

export function usePopoverClose() {
  const close = use(PopoverContext);
  if (!close) throw new Error("usePopoverClose must be used within a PopoverMenu");
  return close;
}

type Props = {
  children: ReactNode;
  /** Content shown alongside the three-dots icon. When provided, the entire wrapper becomes the hover target. */
  label?: ReactNode;
  /** Class name for the wrapper div (only used when label is provided). */
  className?: string;
  /** When true, the popover is forced closed and hover/click interactions are suppressed. */
  disabled?: boolean;
};

export function PopoverMenu({ children, label, className, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Force close when disabled (e.g. during drag)
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setIsPinned(false);
    }
  }, [disabled]);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) setIsPinned(false);
      setIsOpen(open);
    },
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements }) {
          elements.floating.style.minWidth = `${rects.reference.width}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
    placement: "bottom-end",
  });

  const hover = useHover(context, {
    enabled: !isPinned && !disabled,
    handleClose: safePolygon(),
    delay: {
      close: 150,
    },
  });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned) {
      setIsPinned(false);
      setIsOpen(false);
    } else {
      setIsPinned(true);
      setIsOpen(true);
    }
  };

  const close = () => {
    setIsOpen(false);
    setIsPinned(false);
  };

  const dotsIcon = (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );

  const floating = isOpen && (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        className="z-50 flex flex-col bg-elevated border border-border rounded shadow-lg py-0.5"
      >
        <PopoverContext value={close}>{children}</PopoverContext>
      </div>
    </FloatingPortal>
  );

  if (label != null) {
    // Wrapper mode: entire div is the hover target, three-dots button handles click-to-pin
    return (
      <>
        <div ref={refs.setReference} {...getReferenceProps()} className={className}>
          {label}
          <button
            type="button"
            onClick={handleTriggerClick}
            className={clsx(
              "flex items-center justify-center w-5 h-5 text-text-muted hover:text-text-primary cursor-pointer rounded shrink-0",
              isOpen && "text-text-primary",
            )}
            title="Actions"
          >
            {dotsIcon}
          </button>
        </div>
        {floating}
      </>
    );
  }

  // Standalone mode: three-dots button is the hover target
  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        {...getReferenceProps({ onClick: handleTriggerClick })}
        className={clsx(
          "flex items-center justify-center w-5 h-5 text-text-muted hover:text-text-primary cursor-pointer rounded shrink-0",
          isOpen && "text-text-primary",
        )}
        title="Actions"
      >
        {dotsIcon}
      </button>
      {floating}
    </>
  );
}

type ItemProps = Omit<React.ComponentPropsWithoutRef<"button">, "type" | "className"> & {
  keepOpen?: boolean;
  variant?: "default" | "danger" | "accent";
};

function Item({ onClick, keepOpen, variant, disabled, children, ...rest }: ItemProps) {
  const close = use(PopoverContext);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!keepOpen) close?.();
      }}
      className={clsx(
        "w-full text-left px-2 py-0.5 text-xs whitespace-nowrap",
        disabled
          ? "text-text-muted/40 cursor-not-allowed"
          : variant === "danger"
            ? "text-text-muted hover:text-diff-negative cursor-pointer"
            : variant === "accent"
              ? "text-text-muted hover:text-accent cursor-pointer"
              : "text-text-muted hover:text-text-secondary cursor-pointer",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="my-0.5 border-t border-border" />;
}

PopoverMenu.Item = Item;
PopoverMenu.Divider = Divider;
