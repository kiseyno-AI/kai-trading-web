export function normalizeAppBasePath(basePath = process.env.NEXT_PUBLIC_BASE_PATH): string {
  const trimmedBasePath = basePath?.trim() ?? "";

  if (!trimmedBasePath || trimmedBasePath === "/") {
    return "";
  }

  const basePathWithLeadingSlash = trimmedBasePath.startsWith("/")
    ? trimmedBasePath
    : `/${trimmedBasePath}`;
  return basePathWithLeadingSlash.replace(/\/+$/, "");
}

export function withAppBasePath(pathname: `/${string}`, basePath = normalizeAppBasePath()) {
  return `${normalizeAppBasePath(basePath)}${pathname}`;
}
