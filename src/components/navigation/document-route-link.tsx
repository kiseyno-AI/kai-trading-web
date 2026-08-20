"use client";

import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
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
  onPointerDown,
  pendingAcknowledgement = false,
  target,
  ...anchorProps
}: DocumentRouteLinkProps) {
  const { beginNavigation } = useNavigationLoading();
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

        beginNavigation(documentHref);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainPrimaryInteraction(event, target)) return;

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
