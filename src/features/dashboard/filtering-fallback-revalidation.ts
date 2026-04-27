export type FilteringReloadKey = {
  marketDate: string | null;
  reloadCount: number;
};

export const INITIAL_FILTERING_RELOAD_KEY: FilteringReloadKey = {
  marketDate: null,
  reloadCount: -1,
};

export function isFilteringBackgroundReload({
  currentMarketDate,
  previousReloadKey,
  reloadCount,
}: {
  currentMarketDate: string;
  previousReloadKey: FilteringReloadKey;
  reloadCount: number;
}) {
  return previousReloadKey.marketDate === currentMarketDate && previousReloadKey.reloadCount !== reloadCount;
}

export function hasCompletedFilteringReload({
  completionKey,
  currentMarketDate,
  reloadCount,
}: {
  completionKey: FilteringReloadKey;
  currentMarketDate: string | null;
  reloadCount: number;
}) {
  return completionKey.marketDate === currentMarketDate && completionKey.reloadCount === reloadCount;
}
