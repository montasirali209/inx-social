import { Check, Film, ImageIcon } from "lucide-react";
import { formatBytes, formatDuration } from "../../lib/media-format";
import type { MediaAsset } from "../../types/media-library";
import { AssetActionMenu } from "./AssetActionMenu";
import { MediaStatusBadge, SourceBadge } from "./MediaPrimitives";

type Props = {
  asset: MediaAsset;
  layout: "grid" | "list";
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onCheck: () => void;
  onUse: () => void;
  onSchedule: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function MediaCard(props: Props) {
  const duration = formatDuration(props.asset.duration);
  return (
    <article
      className={`interactive-surface group relative min-w-0 overflow-visible rounded-card border transition ${props.layout === "list" ? "grid grid-cols-[minmax(112px,34%)_minmax(0,1fr)]" : ""} ${props.selected ? "border-brand-cyan/65 bg-brand-cyan/[0.055] shadow-[0_0_35px_rgba(20,184,166,.11)]" : "border-border-soft bg-panel/80"}`}
    >
      <button
        aria-label={`Preview ${props.asset.fileName}`}
        className={`block w-full overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-brand-cyan ${props.layout === "list" ? "h-full rounded-l-card" : "rounded-t-card"}`}
        onClick={props.onSelect}
        type="button"
      >
        <span className={`scrollbar-thin relative flex overscroll-contain bg-bg/60 ${props.layout === "list" ? "h-full min-h-32 items-center overflow-hidden rounded-l-card" : "h-44 items-start overflow-y-auto rounded-t-card sm:h-48 2xl:h-44"}`}>
          {props.asset.type === "video" ? (
            <video
              className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
              muted
              preload="metadata"
              src={props.asset.thumbnailUrl}
            />
          ) : (
            <img
              alt=""
              className="m-auto block h-auto min-h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] motion-reduce:transition-none"
              loading="lazy"
              src={props.asset.thumbnailUrl}
            />
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg/45 via-transparent to-transparent" />
          {duration && (
            <span className="absolute right-2 top-2 rounded-md bg-black/75 px-1.5 py-1 text-[9px] text-white">
              {duration}
            </span>
          )}
          <span className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-lg border border-white/10 bg-black/65 text-white">
            {props.asset.type === "video" ? (
              <Film className="size-3.5" />
            ) : (
              <ImageIcon className="size-3.5" />
            )}
          </span>
        </span>
      </button>
      <label className="absolute left-2 top-2 z-10 grid size-6 cursor-pointer place-items-center rounded-lg border border-white/20 bg-bg/80 backdrop-blur">
        <input
          checked={props.checked}
          className="sr-only"
          onChange={props.onCheck}
          type="checkbox"
        />
        <span
          className={`grid size-full place-items-center rounded-lg ${props.checked ? "bg-brand-cyan text-bg" : ""}`}
        >
          {props.checked && <Check className="size-4" />}
        </span>
      </label>
      <div className="p-3">
        <button
          className="block w-full truncate text-left text-xs font-semibold hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan"
          onClick={props.onSelect}
          type="button"
        >
          {props.asset.fileName}
        </button>
        <p className="mt-1 text-[9px] text-text-muted">
          {props.asset.type === "video" ? "Video" : "Image"}
          {props.asset.width && props.asset.height
            ? ` · ${props.asset.width}×${props.asset.height}`
            : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <SourceBadge source={props.asset.source} />
          <MediaStatusBadge status={props.asset.status} />
        </div>
        <footer className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-[9px] text-text-soft">
            {formatBytes(props.asset.fileSize)} ·{" "}
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(new Date(props.asset.createdAt))}
          </span>
          <AssetActionMenu
            asset={props.asset}
            onDelete={props.onDelete}
            onDownload={props.onDownload}
            onDuplicate={props.onDuplicate}
            onRename={props.onRename}
            onSchedule={props.onSchedule}
            onUse={props.onUse}
          />
        </footer>
      </div>
    </article>
  );
}
