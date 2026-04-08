import { cn } from "@/lib/utils";
import { formatChange, formatPrice } from "@/lib/format";
import type { WatchItemDto } from "@/types/trading-api";

type WatchlistItemProps = {
  item: WatchItemDto;
  flashing?: boolean;
  onClick?: () => void;
};

export function WatchlistItem({ item, flashing, onClick }: WatchlistItemProps) {
  const isAvailable = item.available !== false;
  const isUp = (item.change ?? 0) >= 0;
  return (
    <button
      className={cn("watch-item", isAvailable && flashing && (isUp ? "flash-up" : "flash-down"))}
      onClick={onClick}
    >
      <div>
        <strong>{item.symbol}</strong>
        <span>{item.context}</span>
      </div>
      <div className="watch-price">
        <strong>{isAvailable ? formatPrice(item.price) : "Unavailable"}</strong>
        <span>{isAvailable ? formatChange(item.change ?? 0) : "No fresh quote"}</span>
      </div>
    </button>
  );
}
