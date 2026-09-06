import packageMetadata from "../../package.json";

export const RELEASE_VERSION = packageMetadata.version;
export const RELEASE_VERSION_LABEL = `v${RELEASE_VERSION}`;
export const RELEASE_DISPLAY_LABEL = `Release ${RELEASE_VERSION_LABEL}`;
export const RELEASE_REVISION = process.env.NEXT_PUBLIC_APP_REVISION?.trim() || "development";
