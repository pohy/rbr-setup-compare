import {
  autoUpdate,
  FloatingPortal,
  flip,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from "@floating-ui/react";
import clsx from "clsx";
import { createContext, type ReactNode, use, useState } from "react";

const PopoverContext = createContext<(() => void) | null>(null);

export function usePopoverClose() {
  const close = use(PopoverContext);
  if (!close) throw new Error("usePopoverClose must be used within a PopoverMenu");
  return close;
}

type Props = {
  children: ReactNode;
};

export function PopoverMenu({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) setIsPinned(false);
      setIsOpen(open);
    },
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    placement: "bottom-end",
  });

  const hover = useHover(context, {
    enabled: !isPinned,
    delay: { open: 75, close: 150 },
    handleClose: safePolygon(),
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
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 bg-elevated border border-border rounded shadow-lg py-0.5"
          >
            <PopoverContext value={close}>{children}</PopoverContext>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

function Item({
  onClick,
  keepOpen,
  variant,
  children,
}: {
  onClick: () => void;
  keepOpen?: boolean;
  variant?: "default" | "danger" | "accent";
  children: ReactNode;
}) {
  const close = use(PopoverContext);
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        if (!keepOpen) close?.();
      }}
      className={clsx(
        "w-full text-left px-2 py-0.5 text-xs cursor-pointer whitespace-nowrap",
        variant === "danger"
          ? "text-text-muted hover:text-diff-negative"
          : variant === "accent"
            ? "text-text-muted hover:text-accent"
            : "text-text-muted hover:text-text-secondary",
      )}
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
