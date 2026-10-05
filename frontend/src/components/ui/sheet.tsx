import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { PropsWithChildren, RefObject } from "react";
import { Button } from "./button";

export function Sheet({
  children,
  open,
  onOpenChange,
  returnFocusRef,
}: PropsWithChildren<{
  open: boolean;
  onOpenChange: (value: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}>) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="sheet-content"
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <Dialog.Title className="sr-only">Workspace navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Navigate your EduGuard workspace.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="sheet-close"
              aria-label="Close navigation"
            >
              <X size={20} />
            </Button>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
