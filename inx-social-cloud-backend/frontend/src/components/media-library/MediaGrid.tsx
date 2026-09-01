import { ImagePlus, LoaderCircle } from "lucide-react";
import type { MediaAsset } from "../../types/media-library";
import { MediaCard } from "./MediaCard";

type AssetAction = (asset: MediaAsset) => void;

type Props = {
  assets: MediaAsset[];
  selectedId: string | null;
  checkedIds: Set<string>;
  view: "grid" | "list";
  busyId: string | null;
  onSelect: AssetAction;
  onCheck: AssetAction;
  onUse: AssetAction;
  onSchedule: AssetAction;
  onDownload: AssetAction;
  onRename: AssetAction;
  onDuplicate: AssetAction;
  onDelete: AssetAction;
  trashMode?: boolean;
  onRestore?: AssetAction;
  onPurge?: AssetAction;
  onUpload: () => void;
};

export function MediaGrid(props: Props) {
  if (!props.assets.length) {
    return (
      <section className="grid min-h-[420px] place-items-center rounded-panel border border-dashed border-border-soft bg-panel/35 p-6 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-brand-cyan/20 bg-brand-cyan/10 text-brand-cyan">
            <ImagePlus className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold">
            No media matches this view
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-text-muted">
            Upload an image or video, generate a creative with AI, or clear the
            active search and filters.
          </p>
          <button
            className="mt-4 rounded-xl border border-brand-cyan/35 bg-brand-cyan/10 px-4 py-2 text-xs font-semibold text-brand-cyan transition hover:bg-brand-cyan/15 focus-visible:outline-2 focus-visible:outline-brand-cyan"
            onClick={props.onUpload}
            type="button"
          >
            Upload Media
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Media assets"
      className={`grid items-start gap-3 ${props.view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}
    >
      {props.assets.map((asset) => (
        <div className="relative self-start" key={asset.id}>
          {props.busyId === asset.id && (
            <span className="absolute inset-0 z-20 grid place-items-center rounded-card bg-bg/65 backdrop-blur-sm">
              <LoaderCircle className="size-6 animate-spin text-brand-cyan motion-reduce:animate-none" />
            </span>
          )}
          <MediaCard
            asset={asset}
            checked={props.checkedIds.has(asset.id)}
            layout={props.view}
            onCheck={() => props.onCheck(asset)}
            onDelete={() => props.onDelete(asset)}
            onDownload={() => props.onDownload(asset)}
            onDuplicate={() => props.onDuplicate(asset)}
            onPurge={() => props.onPurge?.(asset)}
            onRename={() => props.onRename(asset)}
            onRestore={() => props.onRestore?.(asset)}
            onSchedule={() => props.onSchedule(asset)}
            onSelect={() => props.onSelect(asset)}
            onUse={() => props.onUse(asset)}
            selected={props.selectedId === asset.id}
            trashMode={props.trashMode}
          />
        </div>
      ))}
    </section>
  );
}
