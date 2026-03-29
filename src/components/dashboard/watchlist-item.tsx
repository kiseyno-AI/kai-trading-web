import { cn } from "@/lib/utils";
import { formatChange, formatPrice } from "@/lib/format";
import type { WatchItem } from "@/data/trading-dashboard";

type WatchlistItemProps = {
  item: WatchItem;
  flashing?: boolean;
  onClick?: () => void;
};

export function WatchlistItem({ item, flashing, onClick }: WatchlistItemProps) {
  const isUp = item.change >= 0;
  return (
    <button
      className={cn("watch-item", flashing && (isUp ? "flash-up" : "flash-down"))}
      onClick={onClick}
    >
      <div>
        <strong>{item.symbol}</strong>
        <span>{item.context}</span>
      </div>
      <div className="watch-price">
        <strong>{formatPrice(item.price)}</strong>
        <span>{formatChange(item.change)}</span>
      </div>
    </button>
  );
}
