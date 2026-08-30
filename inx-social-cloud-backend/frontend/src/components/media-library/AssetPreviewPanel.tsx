import { CalendarPlus, Download, MoreHorizontal, Send, X } from "lucide-react";
import { platformReadiness } from "../../data/mediaLibraryData";
import { formatBytes } from "../../lib/media-format";
import type { MediaAsset } from "../../types/media-library";
import { Button } from "../ui/Button";
import {
  MediaStatusBadge,
  ReadinessIcon,
  SourceBadge,
} from "./MediaPrimitives";

type Props = {
  asset: MediaAsset;
  onClose: () => void;
  onUse: () => void;
  onSchedule: () => void;
  onDownload: () => void;
};

export function AssetPreviewPanel({
  asset,
  onClose,
  onUse,
  onSchedule,
  onDownload,
}: Props) {
  const readiness = platformReadiness(asset);
  const showInformation = () =>
    document
      .getElementById(`asset-information-${asset.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <>
      <button
        aria-label="Close asset preview"
        className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm 2xl:hidden"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label={`Preview ${asset.fileName}`}
        className="posts-modal-panel fixed inset-x-2 bottom-2 top-20 z-50 overflow-y-auto rounded-panel border border-brand-cyan/25 bg-panel p-4 shadow-panel sm:left-auto sm:w-[420px] 2xl:sticky 2xl:top-24 2xl:z-auto 2xl:max-h-[calc(100vh-7rem)] 2xl:w-auto"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[.16em] text-brand-cyan">
              Asset Preview
            </p>
            <h2 className="mt-1 truncate text-sm font-semibold">
              {asset.fileName}
            </h2>
          </div>
          <button
            aria-label="Close preview"
            className="rounded-lg p-2 text-text-muted hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-cyan"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border-soft bg-bg/50">
          <div className="aspect-video">
            {asset.type === "video" ? (
              <video
                className="h-full w-full object-contain"
                controls
                preload="metadata"
                src={asset.fileUrl}
              />
            ) : (
              <img
                alt={asset.fileName}
                className="h-full w-full object-contain"
                src={asset.fileUrl}
              />
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SourceBadge source={asset.source} />
          <MediaStatusBadge status={asset.status} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1 border-y border-border-soft py-3">
          {[
            { label: "Use in Post", icon: Send, action: onUse },
            { label: "Schedule", icon: CalendarPlus, action: onSchedule },
            { label: "Download", icon: Download, action: onDownload },
            { label: "More", icon: MoreHorizontal, action: showInformation },
          ].map(({ label, icon: Icon, action }) => (
            <button
              className="rounded-xl px-1 py-2 text-center text-[9px] text-text-muted transition hover:bg-white/5 hover:text-brand-cyan focus-visible:outline-2 focus-visible:outline-brand-cyan"
              key={label}
              onClick={action}
              type="button"
            >
              <Icon className="mx-auto mb-1 size-4" />
              {label}
            </button>
          ))}
        </div>
        <section
          className="mt-4 scroll-mt-3"
          id={`asset-information-${asset.id}`}
        >
          <h3 className="text-xs font-semibold">Asset Information</h3>
          <dl className="mt-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-[10px]">
            <dt className="text-text-soft">Source</dt>
            <dd className="capitalize text-text-muted">
              {asset.source.replace("_", " ")}
            </dd>
            {asset.prompt && (
              <>
                <dt className="text-text-soft">Prompt</dt>
                <dd className="line-clamp-3 text-text-muted">{asset.prompt}</dd>
              </>
            )}
            <dt className="text-text-soft">Dimensions</dt>
            <dd className="text-text-muted">
              {asset.width && asset.height
                ? `${asset.width} × ${asset.height}`
                : "Not reported"}
            </dd>
            <dt className="text-text-soft">File size</dt>
            <dd className="text-text-muted">{formatBytes(asset.fileSize)}</dd>
            <dt className="text-text-soft">Created</dt>
            <dd className="text-text-muted">
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(asset.createdAt))}
            </dd>
            {asset.qualityScore !== null && (
              <>
                <dt className="text-text-soft">AI quality</dt>
                <dd className="text-brand-cyan">{asset.qualityScore}/100</dd>
              </>
            )}
          </dl>
        </section>
        <section className="mt-4 border-t border-border-soft pt-4">
          <h3 className="text-xs font-semibold">Platform Readiness</h3>
          <ul className="mt-2 space-y-1">
            {readiness.map((item) => (
              <li
                className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[10px]"
                key={item.platform}
              >
                <ReadinessIcon platform={item.platform} />
                <span className="flex-1 capitalize text-text-muted">
                  {item.platform === "x" ? "X (Twitter)" : item.platform}
                </span>
                <span
                  className={
                    item.status === "ready"
                      ? "text-brand-green"
                      : "text-brand-amber"
                  }
                >
                  {item.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-4 border-t border-border-soft pt-4">
          <h3 className="text-xs font-semibold">Used In</h3>
          {asset.usedIn.length ? (
            <ul className="mt-2 space-y-2">
              {asset.usedIn.map((post) => (
                <li
                  className="rounded-xl border border-border-soft bg-bg/25 p-2 text-[10px]"
                  key={post.id}
                >
                  <strong>{post.title}</strong>
                  <span className="ml-2 capitalize text-text-soft">
                    {post.status.toLowerCase().replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-border-soft p-4 text-center text-[10px] text-text-soft">
              Not used in any posts yet
            </p>
          )}
        </section>
        <Button
          className="mt-4 w-full 2xl:hidden"
          onClick={onUse}
          type="button"
          variant="primary"
        >
          <Send className="size-4" />
          Use in Post
        </Button>
      </aside>
    </>
  );
}
