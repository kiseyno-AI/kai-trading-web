"use client";

import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import { normalizeAppBasePath, withAppBasePath } from "@/lib/app-base-path";

type DocumentRouteLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode;
  href: string;
};

function resolveDocumentHref(href: string) {
  if (!href.startsWith("/")) return href;

  const basePath = normalizeAppBasePath();
  if (basePath && (href === basePath || href.startsWith(`${basePath}/`))) {
    return href;
  }

  return withAppBasePath(href as `/${string}`, basePath);
}

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>, target: string | undefined) {
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
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainPrimaryClick(event, target)) return;

        beginNavigation(documentHref);
      }}
    >
      {children}
    </a>
  );
}
