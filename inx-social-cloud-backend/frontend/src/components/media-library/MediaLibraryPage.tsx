import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  HardDrive,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { matchesTab } from "../../data/mediaLibraryData";
import {
  archiveMediaAsset,
  createMediaFolder,
  downloadMediaAsset,
  duplicateMediaAsset,
  fetchMediaLibrary,
  purgeMediaAsset,
  renameMediaAsset,
  restoreMediaAsset,
  uploadMediaAsset,
} from "../../lib/media-library-api";
import { formatBytes } from "../../lib/media-format";
import type { MediaAsset, MediaTabId } from "../../types/media-library";
import { Button } from "../ui/Button";
import { AssetPreviewPanel } from "./AssetPreviewPanel";
import { CreateFolderModal } from "./CreateFolderModal";
import { FolderPanel } from "./FolderPanel";
import { MediaGrid } from "./MediaGrid";
import { MediaStatCard } from "./MediaPrimitives";
import { MediaTabs } from "./MediaTabs";
import { MediaToolbar } from "./MediaToolbar";

const PAGE_SIZE = 24;

function folderMatches(asset: MediaAsset, folder: string) {
  if (folder === "all") return true;
  if (folder === "brand_assets") return asset.collection === "brand_assets";
  if (folder === "ai_generated") return asset.source === "ai_generated";
  if (folder === "uploaded") return asset.collection === "uploaded_media";
  if (folder === "scheduled" || folder === "published")
    return asset.status === folder;
  if (folder === "trash") return true;
  return asset.folder?.id === folder;
}

export function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const workspace = useQuery({
    queryKey: ["media-library"],
    queryFn: fetchMediaLibrary,
    refetchInterval: 60_000,
  });
  const [activeTab, setActiveTab] = useState<MediaTabId>("all");
  const [activeFolder, setActiveFolder] = useState("all");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<{
    label: string;
    percent: number;
  } | null>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const assets = useMemo(
    () => workspace.data?.assets || [],
    [workspace.data?.assets],
  );
  const trashAssets = useMemo(
    () => workspace.data?.trashAssets || [],
    [workspace.data?.trashAssets],
  );
  const trashMode = activeFolder === "trash";
  const displayedAssets = trashMode ? trashAssets : assets;
  const selectedAsset = [...assets, ...trashAssets].find((asset) => asset.id === selectedId) || null;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return displayedAssets
      .filter(
        (asset) =>
          matchesTab(asset, activeTab) &&
          folderMatches(asset, activeFolder) &&
          (type === "all" || asset.type === type) &&
          (!query ||
            `${asset.fileName} ${asset.tags.join(" ")}`
              .toLowerCase()
              .includes(query)),
      )
      .sort((a, b) =>
        sort === "oldest"
          ? +new Date(a.createdAt) - +new Date(b.createdAt)
          : sort === "name"
            ? a.fileName.localeCompare(b.fileName)
            : sort === "size"
              ? b.fileSize - a.fileSize
              : +new Date(b.createdAt) - +new Date(a.createdAt),
      );
  }, [activeFolder, activeTab, displayedAssets, search, sort, type]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const stats = useMemo(
    () => [
      {
        label: "Total Assets",
        value: assets.length,
        detail: "Live library total",
        tone: "teal" as const,
        icon: "total" as const,
      },
      {
        label: "AI Generated",
        value: assets.filter((asset) => asset.source === "ai_generated").length,
        detail: "From AI Content Studio",
        tone: "purple" as const,
        icon: "ai" as const,
      },
      {
        label: "Ready to Use",
        value: assets.filter(
          (asset) => asset.contentAvailable && asset.status !== "needs_review",
        ).length,
        detail: "Available to your composer",
        tone: "green" as const,
        icon: "ready" as const,
      },
      {
        label: "Used in Posts",
        value: assets.filter((asset) => asset.usedIn.length > 0).length,
        detail: "Linked publishing records",
        tone: "amber" as const,
        icon: "used" as const,
      },
      {
        label: "Needs Review",
        value: assets.filter((asset) => asset.status === "needs_review").length,
        detail: "Assets needing attention",
        tone: "red" as const,
        icon: "review" as const,
      },
    ],
    [assets],
  );

  function notify(tone: "success" | "error", text: string) {
    setMessage({ tone, text });
    window.setTimeout(
      () => setMessage((current) => (current?.text === text ? null : current)),
      4500,
    );
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["media-library"] });
  }

  async function uploadFiles(files: FileList | File[]) {
    const chosen = Array.from(files);
    if (!chosen.length) return;
    const customFolderId = workspace.data?.folders.some(
      (folder) => folder.id === activeFolder,
    )
      ? activeFolder
      : null;
    try {
      for (let index = 0; index < chosen.length; index += 1) {
        const file = chosen[index];
        setUploadState({
          label: `Uploading ${file.name} · ${index + 1} of ${chosen.length}`,
          percent: 0,
        });
        await uploadMediaAsset(file, customFolderId, (percent) =>
          setUploadState({
            label: `Uploading ${file.name} · ${index + 1} of ${chosen.length}`,
            percent,
          }),
        );
      }
      await refresh();
      notify(
        "success",
        `${chosen.length} media asset${chosen.length === 1 ? "" : "s"} added to your library.`,
      );
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "The media upload failed.",
      );
    } finally {
      setUploadState(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function runAssetAction(
    asset: MediaAsset,
    action: () => Promise<unknown>,
    success: string,
  ) {
    setBusyId(asset.id);
    try {
      await action();
      await refresh();
      notify("success", success);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "The asset action failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function openComposer(asset: MediaAsset, scheduleMode: "later" | "now") {
    navigate("/posts", { state: { mediaLibraryAsset: asset, scheduleMode } });
  }

  function rename(asset: MediaAsset) {
    const fileName = window
      .prompt("Rename this media asset", asset.fileName)
      ?.trim();
    if (fileName && fileName !== asset.fileName)
      void runAssetAction(
        asset,
        () => renameMediaAsset(asset.id, fileName),
        "Asset renamed.",
      );
  }

  function remove(asset: MediaAsset) {
    if (
      window.confirm(
        `Move “${asset.fileName}” out of the active Media Library?`,
      )
    )
      void runAssetAction(
        asset,
        () => archiveMediaAsset(asset.id),
        "Asset removed from the active library.",
      );
  }

  function restore(asset: MediaAsset) {
    void runAssetAction(
      asset,
      () => restoreMediaAsset(asset.id),
      "Asset restored to All Files.",
    );
  }

  function purge(asset: MediaAsset) {
    if (!window.confirm(`Permanently delete “${asset.fileName}”? This cannot be undone.`)) return;
    void runAssetAction(
      asset,
      () => purgeMediaAsset(asset.id),
      "Asset permanently deleted.",
    );
    if (selectedId === asset.id) setSelectedId(null);
  }

  async function createFolder(name: string) {
    setFolderBusy(true);
    setFolderError("");
    try {
      const result = await createMediaFolder(name);
      await refresh();
      setActiveFolder(result.folder.id);
      setFolderModalOpen(false);
      notify("success", `Folder “${result.folder.name}” created.`);
    } catch (error) {
      setFolderError(
        error instanceof Error
          ? error.message
          : "The folder could not be created.",
      );
    } finally {
      setFolderBusy(false);
    }
  }

  const handlers = {
    onUse: (asset: MediaAsset) => openComposer(asset, "later"),
    onSchedule: (asset: MediaAsset) => openComposer(asset, "later"),
    onDownload: (asset: MediaAsset) =>
      void downloadMediaAsset(asset).catch((error) =>
        notify(
          "error",
          error instanceof Error ? error.message : "Download failed.",
        ),
      ),
    onRename: rename,
    onDuplicate: (asset: MediaAsset) =>
      void runAssetAction(
        asset,
        () => duplicateMediaAsset(asset.id),
        "Asset duplicated.",
      ),
    onDelete: remove,
  };

  if (workspace.isLoading) return <MediaLibrarySkeleton />;
  if (workspace.isError || !workspace.data)
    return (
      <section className="rounded-panel border border-brand-red/25 bg-brand-red/8 p-6">
        <h2 className="font-semibold">Media Library unavailable</h2>
        <p className="mt-2 text-sm text-text-muted">
          {workspace.error instanceof Error
            ? workspace.error.message
            : "Refresh the workspace and try again."}
        </p>
        <Button
          className="mt-4"
          onClick={() => void workspace.refetch()}
          type="button"
        >
          Retry
        </Button>
      </section>
    );

  const storagePercent = Math.min(
    100,
    Math.round(
      (workspace.data.storage.usedBytes /
        Math.max(1, workspace.data.storage.limitBytes)) *
        100,
    ),
  );
  const first = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="dashboard-canvas pb-8">
      <input
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        className="sr-only"
        multiple
        onChange={(event) => {
          if (event.target.files) void uploadFiles(event.target.files);
        }}
        ref={inputRef}
        type="file"
      />
      {message && (
        <div
          aria-live="polite"
          className={`fixed right-4 top-24 z-[80] flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-xs shadow-panel backdrop-blur-xl ${message.tone === "success" ? "border-brand-green/30 bg-[#09251f]/95 text-brand-green" : "border-brand-red/30 bg-[#2a1018]/95 text-brand-red"}`}
        >
          {message.tone === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <ShieldAlert className="size-4" />
          )}
          <span className="flex-1">{message.text}</span>
          <button
            aria-label="Dismiss"
            onClick={() => setMessage(null)}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <MediaStatCard key={stat.label} {...stat} />
        ))}
      </div>
      <section className="mt-4 rounded-panel border border-border-soft bg-panel/65 p-3 shadow-panel">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <MediaTabs
            active={activeTab}
            assets={displayedAssets}
            onChange={(value) => {
              setActiveTab(value);
              setPage(1);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[190px] flex-1 rounded-xl border border-border-soft bg-bg/30 px-3 py-2 xl:flex-none">
              <div className="flex items-center justify-between gap-3 text-[9px]">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <HardDrive className="size-3.5 text-brand-cyan" />
                  {formatBytes(workspace.data.storage.usedBytes)} of{" "}
                  {formatBytes(workspace.data.storage.limitBytes)}
                </span>
                <span className="text-brand-cyan">{storagePercent}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/7">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-brand-green to-brand-cyan"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </div>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-cyan/25 px-3 text-[10px] font-semibold text-brand-cyan transition hover:bg-brand-cyan/10 focus-visible:outline-2 focus-visible:outline-brand-cyan"
              href="/portal/#overview"
            >
              Upgrade Plan
            </a>
            <Button onClick={() => setFolderModalOpen(true)} type="button">
              <FolderPlus className="size-4" />
              Create Folder
            </Button>
            <Button
              disabled={Boolean(uploadState)}
              onClick={() => inputRef.current?.click()}
              type="button"
              variant="primary"
            >
              <Upload className="size-4" />
              {uploadState ? `${uploadState.percent}%` : "Upload Media"}
            </Button>
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-brand-cyan/35 bg-brand-cyan/8 px-4 text-sm font-semibold text-brand-cyan transition hover:bg-brand-cyan/15 focus-visible:outline-2 focus-visible:outline-brand-cyan"
              href="/studio/?view=agent"
            >
              <Sparkles className="size-4" />
              Generate with AI
            </a>
          </div>
        </div>
        {uploadState && (
          <div className="mt-3">
            <div className="flex justify-between text-[9px] text-text-muted">
              <span className="truncate">{uploadState.label}</span>
              <span>{uploadState.percent}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/7">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand-green to-brand-cyan transition-all"
                style={{ width: `${uploadState.percent}%` }}
              />
            </div>
          </div>
        )}
      </section>
      <div
        className={`mt-4 grid items-start gap-4 ${selectedAsset ? "2xl:grid-cols-[230px_minmax(0,1fr)_330px]" : "2xl:grid-cols-[230px_minmax(0,1fr)]"}`}
      >
        <FolderPanel
          active={activeFolder}
          assets={assets}
          folders={workspace.data.folders}
          onActive={(id) => {
            setActiveFolder(id);
            setActiveTab("all");
            setSelectedId(null);
            setPage(1);
            setFoldersOpen(false);
          }}
          onClose={() => setFoldersOpen(false)}
          onCreateFolder={() => setFolderModalOpen(true)}
          open={foldersOpen}
          trashAssets={trashAssets}
        />
        <main className="min-w-0 2xl:min-h-0">
          <MediaToolbar
            onFolders={() => setFoldersOpen(true)}
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            onSort={(value) => {
              setSort(value);
              setPage(1);
            }}
            onType={(value) => {
              setType(value);
              setPage(1);
            }}
            onView={setView}
            search={search}
            sort={sort}
            type={type}
            view={view}
          />
          <div className="scrollbar-thin mt-3 min-h-[360px] overscroll-contain 2xl:max-h-[calc(100vh-25rem)] 2xl:overflow-y-auto 2xl:pr-1">
            <MediaGrid
              assets={visible}
              busyId={busyId}
              checkedIds={checkedIds}
              onCheck={(asset) =>
                setCheckedIds((current) => {
                  const next = new Set(current);
                  if (next.has(asset.id)) next.delete(asset.id);
                  else next.add(asset.id);
                  return next;
                })
              }
              onSelect={(asset) => setSelectedId(asset.id)}
              onPurge={purge}
              onRestore={restore}
              onUpload={() => inputRef.current?.click()}
              selectedId={selectedId}
              trashMode={trashMode}
              view={view}
              {...handlers}
            />
          </div>
          <footer className="mt-5 flex flex-col items-center justify-between gap-3 rounded-xl border border-border-soft bg-panel/40 p-3 text-[10px] text-text-muted sm:flex-row">
            <span>
              Showing {first} to {last} of {filtered.length.toLocaleString()}{" "}
              assets
            </span>
            <nav
              aria-label="Media pagination"
              className="flex items-center gap-1"
            >
              <button
                aria-label="Previous page"
                className="grid size-9 place-items-center rounded-lg border border-border-soft disabled:opacity-35"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: Math.min(5, pages) }, (_, index) => {
                const candidate =
                  pages <= 5
                    ? index + 1
                    : Math.min(Math.max(1, currentPage - 2), pages - 4) + index;
                return (
                  <button
                    aria-current={candidate === currentPage ? "page" : undefined}
                    className={`grid size-9 place-items-center rounded-lg border ${candidate === currentPage ? "border-brand-cyan/40 bg-brand-cyan/12 text-brand-cyan" : "border-transparent hover:border-border-soft"}`}
                    key={candidate}
                    onClick={() => setPage(candidate)}
                    type="button"
                  >
                    {candidate}
                  </button>
                );
              })}
              <button
                aria-label="Next page"
                className="grid size-9 place-items-center rounded-lg border border-border-soft disabled:opacity-35"
                disabled={currentPage === pages}
                onClick={() => setPage((value) => Math.min(pages, value + 1))}
                type="button"
              >
                <ChevronRight className="size-4" />
              </button>
            </nav>
          </footer>
        </main>
        {selectedAsset && (
          <AssetPreviewPanel
            asset={selectedAsset}
            onClose={() => setSelectedId(null)}
            onDownload={() => handlers.onDownload(selectedAsset)}
            onDelete={() => handlers.onDelete(selectedAsset)}
            onDuplicate={() => handlers.onDuplicate(selectedAsset)}
            onRename={() => handlers.onRename(selectedAsset)}
            onRestore={() => restore(selectedAsset)}
            onPurge={() => purge(selectedAsset)}
            onSchedule={() => handlers.onSchedule(selectedAsset)}
            onUse={() => handlers.onUse(selectedAsset)}
            trashMode={trashMode}
          />
        )}
      </div>
      {folderModalOpen && (
        <CreateFolderModal
          busy={folderBusy}
          error={folderError}
          onClose={() => {
            if (!folderBusy) {
              setFolderModalOpen(false);
              setFolderError("");
            }
          }}
          onCreate={(name) => void createFolder(name)}
        />
      )}
    </div>
  );
}

function MediaLibrarySkeleton() {
  return (
    <div aria-label="Loading Media Library" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            className="h-28 animate-pulse rounded-card border border-border-soft bg-panel/70"
            key={index}
          />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-panel border border-border-soft bg-panel/70" />
      <div className="grid gap-4 2xl:grid-cols-[230px_1fr_330px]">
        <div className="h-[640px] animate-pulse rounded-panel border border-border-soft bg-panel/70" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              className="h-64 animate-pulse rounded-card border border-border-soft bg-panel/70"
              key={index}
            />
          ))}
        </div>
        <div className="h-[640px] animate-pulse rounded-panel border border-border-soft bg-panel/70" />
      </div>
    </div>
  );
}
