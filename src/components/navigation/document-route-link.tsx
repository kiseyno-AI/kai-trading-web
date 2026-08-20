"use client";

import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
} from "react";

import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import { normalizeAppBasePath, withAppBasePath } from "@/lib/app-base-path";

type DocumentRouteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode;
  href: string;
  pendingAcknowledgement?: boolean;
};

function resolveDocumentHref(href: string) {
  if (!href.startsWith("/")) return href;

  const basePath = normalizeAppBasePath();
  if (basePath && (href === basePath || href.startsWith(`${basePath}/`))) {
    return href;
  }

  return withAppBasePath(href as `/${string}`, basePath);
}

function isPlainPrimaryInteraction(
  event: MouseEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>,
  target: string | undefined,
) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    (!target || target === "_self")
  );
}

export function DocumentRouteLink({
  children,
  href,
  onClick,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerUp,
  pendingAcknowledgement = false,
  target,
  ...anchorProps
}: DocumentRouteLinkProps) {
  const { beginNavigation, cancelNavigation } = useNavigationLoading();
  const pendingPointerIdRef = useRef<number | null>(null);
  const documentHref = resolveDocumentHref(href);

  return (
    <a
      {...anchorProps}
      href={documentHref}
      target={target}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (
          !pendingAcknowledgement ||
          event.defaultPrevented ||
          !isPlainPrimaryInteraction(event, target)
        ) {
          return;
        }

        pendingPointerIdRef.current = event.pointerId;
        beginNavigation(documentHref);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        if (pendingPointerIdRef.current !== event.pointerId) return;

        pendingPointerIdRef.current = null;
        if (event.defaultPrevented) {
          cancelNavigation(documentHref);
        }
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        if (pendingPointerIdRef.current !== event.pointerId) return;

        pendingPointerIdRef.current = null;
        cancelNavigation(documentHref);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (pendingPointerIdRef.current !== event.pointerId) return;

        pendingPointerIdRef.current = null;
        cancelNavigation(documentHref);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainPrimaryInteraction(event, target)) {
          if (pendingAcknowledgement) {
            cancelNavigation(documentHref);
          }
          return;
        }

        beginNavigation(documentHref);
        if (!pendingAcknowledgement || event.detail !== 0) {
          return;
        }

        event.preventDefault();
        window.requestAnimationFrame(() => {
          window.setTimeout(() => window.location.assign(documentHref), 0);
        });
      }}
    >
      {children}
    </a>
  );
}
