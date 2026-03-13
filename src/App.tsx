import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

type ProjectType = "all" | "mod" | "plugin" | "modpack" | "datapack";
type SortType = "relevance" | "downloads" | "updated";
type Theme = "minimalism" | "brutalism" | "glassmorphism";

type SearchHit = {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  project_type: string;
  icon_url: string | null;
  downloads: number;
  date_modified: string;
  categories: string[];
};

type SearchResponse = {
  hits: SearchHit[];
};

type VersionFile = {
  filename: string;
  url: string;
  primary: boolean;
  size: number;
};

type ProjectVersion = {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  date_published: string;
  files: VersionFile[];
};

type QueueStatus = "pending" | "running" | "done" | "error" | "canceled" | "paused";

type Profile = {
  id: string;
  name: string;
  folderPath: string;
};

type QueueItem = {
  id: string;
  projectId: string;
  projectTitle: string;
  versionId: string;
  versionName: string;
  fileName: string;
  url: string;
  size: number;
  status: QueueStatus;
  progress: number;
  error: any;
};

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    __TAURI_INTERNALS__?: unknown;
  }
}

const LOADERS = [
  "all", "fabric", "forge", "neoforge", "quilt",
  "paper", "spigot", "bukkit", "velocity",
] as const;

const VERSION_SUGGESTIONS = [
  "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1", "1.17",
  "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1",
  "1.15.2", "1.14.4", "1.13.2", "1.12.2",
  "1.8.9", "1.7.10",
];

const THEMES: { value: Theme; label: string }[] = [
  { value: "minimalism", label: "Minimal" },
  { value: "brutalism", label: "Brutalism" },
  { value: "glassmorphism", label: "Glass" },
];

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h5L12 8.5h7.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v10" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
      <path d="M4 19h16" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12 4 7.5" />
      <path d="M12 12v9" />
      <path d="m12 12 8-4.5" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a9 9 0 1 1-4.2-7.6" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1.5" fill="currentColor" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 10v7" />
      <path d="M14 10v7" />
    </svg>
  );
}

function IconFolderOpen() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h5L12 8.5h7.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <path d="M11 13h6" />
      <path d="m14 10 3 3-3 3" />
    </svg>
  );
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatRelativeTime(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getPathLabel(path: string) {
  const chunks = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return chunks[chunks.length - 1] || path || "mods";
}

function barColor(status: QueueStatus) {
  if (status === "done") return "var(--bar-done)";
  if (status === "running") return "var(--bar-run)";
  if (status === "paused") return "var(--text-3)";
  if (status === "error") return "var(--bar-err)";
  return "var(--text-4)";
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("rinthdesk-theme");
      if (saved && THEMES.some(t => t.value === saved)) return saved as Theme;
    } catch {
    }
    return "minimalism";
  });

  const [query, setQuery] = useState("sodium");
  const [debouncedQuery, setDebouncedQuery] = useState("sodium");
  const [projectType, setProjectType] = useState<ProjectType>("mod");
  const [loader, setLoader] = useState<typeof LOADERS[number]>("fabric");
  const [gameVersion, setGameVersion] = useState("1.20.1");
  const [sort, setSort] = useState<SortType>("relevance");

  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedProject, setSelectedProject] = useState<SearchHit | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [selectedVersionIds, setSelectedVersionIds] = useState<Set<string>>(new Set());
  const [versionSearch, setVersionSearch] = useState("");

  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueSearch, setQueueSearch] = useState("");
  const [queuePaused, setQueuePaused] = useState(false);
  const [installedSearch, setInstalledSearch] = useState("");
  const [isRemovingInstalled, setIsRemovingInstalled] = useState(false);

  const [folderLabel, setFolderLabel] = useState("Browser default downloads");
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [tauriFolderPath, setTauriFolderPath] = useState<string | null>(null);
  const [installedFiles, setInstalledFiles] = useState<Set<string>>(new Set());
  const [isCheckingInstalled, setIsCheckingInstalled] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const raw = localStorage.getItem("rinthdesk-profiles");
      return raw ? (JSON.parse(raw) as Profile[]) : [];
    } catch {
      return [];
    }
  });
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [newProfileName, setNewProfileName] = useState("");

  const downloadControllers = useRef(new Map<string, AbortController>());
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("rinthdesk-theme", theme);
    } catch {
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem("rinthdesk-profiles", JSON.stringify(profiles));
    } catch {
    }
  }, [profiles]);

  useEffect(() => {
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) return;
    setDirectoryHandle(null);
    setTauriFolderPath(profile.folderPath);
    setFolderLabel(profile.folderPath);
  }, [profiles, activeProfileId]);

  useEffect(() => {
    async function loadInstalledFiles() {
      if (isTauri && tauriFolderPath) {
        setIsCheckingInstalled(true);
        try {
          const names = await invoke<string[]>("list_folder_files", { folderPath: tauriFolderPath });
          setInstalledFiles(new Set(names));
        } catch {
          setInstalledFiles(new Set());
        } finally {
          setIsCheckingInstalled(false);
        }
        return;
      }

      if (directoryHandle) {
        setInstalledFiles(new Set());
        setIsCheckingInstalled(false);
        return;
      }

      setInstalledFiles(new Set());
      setIsCheckingInstalled(false);
    }

    loadInstalledFiles();
  }, [isTauri, tauriFolderPath, directoryHandle]);

  const selectedVersions = useMemo(
    () => versions.filter(v => selectedVersionIds.has(v.id)),
    [versions, selectedVersionIds]
  );

  const visibleVersions = useMemo(() => {
    const typed = versionSearch.trim().toLowerCase();
    if (typed) {
      return versions.filter(v => {
        const num = (v.version_number || "").toLowerCase();
        const name = (v.name || "").toLowerCase();
        if (typed.length < 3) return num.startsWith(typed) || name.startsWith(typed);
        return num.includes(typed) || name.includes(typed) || v.game_versions.join(" ").toLowerCase().includes(typed);
      });
    }
    const gv = gameVersion.trim();
    if (!gv) return versions;
    return versions.filter(v => v.game_versions.includes(gv));
  }, [versions, versionSearch, gameVersion]);

  const queueVisibleItems = useMemo(() => {
    const term = queueSearch.trim().toLowerCase();
    if (!term) return queueItems;
    return queueItems.filter(item => {
      const hay = `${item.projectTitle} ${item.versionName} ${item.fileName} ${item.status}`.toLowerCase();
      return hay.includes(term);
    });
  }, [queueItems, queueSearch]);

  const activeProfile = useMemo(
    () => profiles.find(p => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  const installedVisibleFiles = useMemo(() => {
    const term = installedSearch.trim().toLowerCase();
    const all = Array.from(installedFiles).sort((a, b) => a.localeCompare(b));
    if (!term) return all;
    return all.filter(name => name.toLowerCase().includes(term));
  }, [installedFiles, installedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    async function doSearch() {
      setIsSearching(true);
      setSearchError(null);
      try {
        console.log("search", debouncedQuery, projectType, loader, gameVersion);
        const facets: string[][] = [];
        if (projectType !== "all") facets.push([`project_type:${projectType}`]);
        if (loader !== "all") facets.push([`categories:${loader}`]);
        const gv = gameVersion.trim();
        if (gv) facets.push([`versions:${gv}`]);
        const params = new URLSearchParams({
          query: debouncedQuery.trim(),
          index: sort,
          limit: "40",
        });
        if (facets.length > 0) params.set("facets", JSON.stringify(facets));
        const res = await fetch(`https://api.modrinth.com/v2/search?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = (await res.json()) as SearchResponse;
        setSearchHits(data.hits ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSearchError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }
    doSearch();
    return () => controller.abort();
  }, [debouncedQuery, projectType, loader, gameVersion, sort]);

  useEffect(() => {
    if (!selectedProject) {
      setVersions([]);
      setSelectedVersionIds(new Set());
      return;
    }
    const proj = selectedProject;
    const controller = new AbortController();
    async function load() {
      setIsLoadingVersions(true);
      setVersionError(null);
      setSelectedVersionIds(new Set());
      setVersionSearch("");
      try {
        console.log("loading versions for", proj.slug || proj.project_id);
        const res = await fetch(
          `https://api.modrinth.com/v2/project/${proj.project_id}/version`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(`Version fetch failed (${res.status})`);
        const data = (await res.json()) as ProjectVersion[];
        const filtered = loader === "all"
          ? data
          : data.filter(v => v.loaders.includes(loader));
        filtered.sort((a, b) =>
          new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
        );
        setVersions(filtered);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setVersionError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setIsLoadingVersions(false);
      }
    }
    load();
    return () => controller.abort();
  }, [selectedProject, loader]);

  const pickFolder = useCallback(async () => {
    if (isTauri) {
      try {
        const path = await invoke<string | null>("pick_folder");
        if (!path) return;
        setDirectoryHandle(null);
        setTauriFolderPath(path);
        setFolderLabel(path);
      } catch (err) {
        console.log("folder picker bailed", err);
        setFolderLabel("couldn't pick folder rn, try again");
      }
      return;
    }
    if (!window.showDirectoryPicker) {
      setFolderLabel("Browser default downloads");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker();
      setDirectoryHandle(handle);
      setTauriFolderPath(null);
      setFolderLabel(handle.name || "Selected folder");
    } catch {
      setFolderLabel("Browser default downloads");
    }
  }, [isTauri]);

  const toggleVersion = useCallback((id: string) => {
    setSelectedVersionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectTypedVersion = useCallback(() => {
    const term = versionSearch.trim().toLowerCase();
    if (!term) return;
    const exact = versions.find(v =>
      v.version_number.toLowerCase() === term || v.name.toLowerCase() === term
    );
    const pick = exact ?? visibleVersions[0];
    if (pick) setSelectedVersionIds(new Set([pick.id]));
  }, [versionSearch, versions, visibleVersions]);

  const enqueueSelected = useCallback(() => {
    // TODO: maybe batch these inserts with a reducer
    if (!selectedProject || selectedVersions.length === 0) return;
    const proj = selectedProject;
    setQueueItems(prev => {
      const next = [...prev];
      for (const ver of selectedVersions) {
        const file = ver.files.find(f => f.primary) ?? ver.files[0];
        if (!file) continue;
        if (installedFiles.has(file.filename)) continue;
        const id = `${proj.project_id}:${ver.id}:${file.filename}`;
        if (next.some(x => x.id === id)) continue;
        next.push({
          id,
          projectId: proj.project_id,
          projectTitle: proj.title,
          versionId: ver.id,
          versionName: ver.version_number || ver.name,
          fileName: file.filename,
          url: file.url,
          size: file.size,
          status: "pending",
          progress: 0,
          error: null,
        });
      }
      return next;
    });
  }, [selectedProject, selectedVersions, installedFiles]);

  const enqueueVersion = useCallback((ver: ProjectVersion) => {
    if (!selectedProject) return;
    const file = ver.files.find(f => f.primary) ?? ver.files[0];
    if (!file) return;
    if (installedFiles.has(file.filename)) return;
    const id = `${selectedProject.project_id}:${ver.id}:${file.filename}`;
    setQueueItems(prev => {
      if (prev.some(x => x.id === id)) return prev;
      return [
        ...prev,
        {
          id,
          projectId: selectedProject.project_id,
          projectTitle: selectedProject.title,
          versionId: ver.id,
          versionName: ver.version_number || ver.name,
          fileName: file.filename,
          url: file.url,
          size: file.size,
          status: "pending",
          progress: 0,
          error: null,
        },
      ];
    });
  }, [selectedProject, installedFiles]);

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueueItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const runDownload = useCallback(async (item: QueueItem) => {
    // this works but i should refactor this later
    const controller = new AbortController();
    downloadControllers.current.set(item.id, controller);
    updateItem(item.id, { status: "running", progress: 0, error: null });

    try {
      if (isTauri) {
        if (!tauriFolderPath) throw new Error("Choose a folder first.");
        updateItem(item.id, { progress: 15 });
        await invoke("download_file", {
          url: item.url,
          fileName: item.fileName,
          folderPath: tauriFolderPath,
        });
        setInstalledFiles(prev => new Set(prev).add(item.fileName));
        updateItem(item.id, { progress: 100, status: "done", error: null });
        return;
      }

      const res = await fetch(item.url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const total = Number(res.headers.get("content-length") || item.size || 0);

      if (directoryHandle) {
        if (!res.body) throw new Error("No stream");
        const reader = res.body.getReader();
        let loaded = 0;
        const fh = await directoryHandle.getFileHandle(item.fileName, { create: true });
        const writable = await fh.createWritable();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            loaded += value.length;
            await writable.write(value);
            if (total > 0) updateItem(item.id, { progress: Math.min((loaded / total) * 100, 100) });
          }
        }
        await writable.close();
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = item.fileName;
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      setInstalledFiles(prev => new Set(prev).add(item.fileName));
      updateItem(item.id, { status: "done", progress: 100, error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        updateItem(item.id, {
          status: queuePaused ? "paused" : "canceled",
          error: queuePaused ? "Paused" : "Canceled",
        });
      } else {
        updateItem(item.id, { status: "error", error: (err as Error).message });
      }
    } finally {
      downloadControllers.current.delete(item.id);
    }
  }, [directoryHandle, isTauri, updateItem, tauriFolderPath, queuePaused]);

  useEffect(() => {
    if (queuePaused) return;
    const running = queueItems.some(i => i.status === "running");
    if (running) return;
    const next = queueItems.find(i => i.status === "pending");
    if (!next) return;
    const timer = window.setTimeout(() => runDownload(next), 120);
    return () => window.clearTimeout(timer);
  }, [queueItems, runDownload, queuePaused]);

  const retryItem = useCallback((id: string) => {
    updateItem(id, { status: "pending", progress: 0, error: null });
  }, [updateItem]);

  const cancelItem = useCallback((id: string) => {
    downloadControllers.current.get(id)?.abort();
  }, []);

  const removeItem = useCallback((id: string) => {
    setQueueItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const pauseAll = useCallback(() => {
    setQueuePaused(true);
    if (!isTauri) {
      for (const controller of downloadControllers.current.values()) {
        controller.abort();
      }
      setQueueItems(prev => prev.map(item =>
        item.status === "running" ? { ...item, status: "paused", error: "Paused" } : item
      ));
    }
  }, [isTauri]);

  const resumeAll = useCallback(() => {
    setQueueItems(prev => prev.map(item =>
      item.status === "paused" ? { ...item, status: "pending", error: null } : item
    ));
    setQueuePaused(false);
  }, []);

  const createProfile = useCallback(async () => {
    // TODO: add profile rename UI
    const name = newProfileName.trim();
    if (!name || !isTauri) return;

    try {
      const path = await invoke<string | null>("pick_folder");
      if (!path) return;

      const next: Profile = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        folderPath: path,
      };

      setProfiles(prev => [...prev, next]);
      setActiveProfileId(next.id);
      setDirectoryHandle(null);
      setTauriFolderPath(path);
      setFolderLabel(path);
      setNewProfileName("");
    } catch (err) {
      console.log("profile create failed", err);
    }
  }, [newProfileName, isTauri]);

  const deleteActiveProfile = useCallback(() => {
    if (!activeProfileId) return;
    setProfiles(prev => prev.filter(p => p.id !== activeProfileId));
    setActiveProfileId("");
  }, [activeProfileId]);

  const openCurrentFolder = useCallback(async () => {
    if (!isTauri || !tauriFolderPath) return;
    try {
      await invoke("open_folder", { folderPath: tauriFolderPath });
    } catch (err) {
      console.log("open folder failed", err);
    }
  }, [isTauri, tauriFolderPath]);

  const removeInstalledFile = useCallback(async (fileName: string) => {
    // TODO: bulk remove by extension
    if (!isTauri || !tauriFolderPath) return;
    setIsRemovingInstalled(true);
    try {
      await invoke("remove_file", { folderPath: tauriFolderPath, fileName });
      setInstalledFiles(prev => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
      setQueueItems(prev => prev.filter(item => item.fileName !== fileName));
    } catch {
    } finally {
      setIsRemovingInstalled(false);
    }
  }, [isTauri, tauriFolderPath]);

  const minimizeWindow = useCallback(async () => {
    if (!isTauri) return;
    await invoke("window_minimize");
  }, [isTauri]);

  const toggleMaximizeWindow = useCallback(async () => {
    if (!isTauri) return;
    await invoke("window_toggle_maximize");
  }, [isTauri]);

  const closeWindow = useCallback(async () => {
    if (!isTauri) return;
    await invoke("window_close");
  }, [isTauri]);

  const startWindowDrag = useCallback(async (event: MouseEvent<HTMLElement>) => {
    if (!isTauri || event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, select, textarea, a, label")) return;

    await invoke("window_start_dragging");
  }, [isTauri]);

  const queueDone = queueItems.filter(i => i.status === "done").length;
  const queueTotal = queueItems.length;

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ background: "var(--bg-app)", color: "var(--text-1)" }}
    >
      {theme === "glassmorphism" && <div className="theme-backdrop-glass" />}

      <header
        className="h-14 flex-shrink-0 flex items-center px-5 relative z-10 select-none"
        style={{
          background: "var(--bg-header)",
          borderBottom: "var(--border-w) solid var(--border)",
        }}
        onMouseDown={startWindowDrag}
      >
        <div className="flex items-center gap-2.5" data-tauri-drag-region={isTauri ? "" : undefined}>
          <span style={{ color: "var(--accent)" }}><IconPackage /></span>
          <p className="text-[15px] font-semibold tracking-tight">RinthDesk</p>
          <span className="text-xs" style={{ color: "var(--text-4)" }}>v0.1</span>
        </div>

        <div className="flex-1 h-full" data-tauri-drag-region={isTauri ? "" : undefined} />

        <div className="flex items-center gap-3">
          {queueTotal > 0 && (
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              {queueDone}/{queueTotal} done
            </span>
          )}
          <span style={{ color: "var(--text-3)" }}><IconPalette /></span>
          <select
            value={theme}
            onChange={e => setTheme(e.target.value as Theme)}
            className="input-field px-2 py-1.5 text-xs"
          >
            {THEMES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {isTauri && (
            <div className="flex items-center gap-1 ml-1" style={{ borderLeft: "1px solid var(--border)", paddingLeft: 8 }}>
              <button onClick={minimizeWindow} className="btn w-8 h-8 text-sm leading-none">_</button>
              <button onClick={toggleMaximizeWindow} className="btn w-8 h-8 text-sm leading-none">□</button>
              <button onClick={closeWindow} className="btn w-8 h-8 text-sm leading-none">×</button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 min-h-0 grid gap-3 p-3 lg:grid-cols-[360px_minmax(0,1fr)_360px] relative z-10">
        <section className="panel flex flex-col min-h-0 overflow-hidden">
          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <label
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest mb-1.5"
              style={{ color: "var(--text-3)" }}
            >
              <IconSearch /> Search
            </label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search mods, plugins, datapacks..."
              className="input-field w-full px-3 py-2 text-sm"
            />
          </div>

          <div className="p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <p
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest mb-2"
              style={{ color: "var(--text-3)" }}
            >
              <IconFilter /> Filters
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={projectType}
                onChange={e => setProjectType(e.target.value as ProjectType)}
                className="input-field px-2 py-2 text-xs"
              >
                <option value="all">All types</option>
                <option value="mod">Mods</option>
                <option value="plugin">Plugins</option>
                <option value="modpack">Modpacks</option>
                <option value="datapack">Datapacks</option>
              </select>

              <select
                value={loader}
                onChange={e => setLoader(e.target.value as typeof LOADERS[number])}
                className="input-field px-2 py-2 text-xs"
              >
                {LOADERS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>

              <input
                value={gameVersion}
                onChange={e => setGameVersion(e.target.value)}
                placeholder="any version"
                list="gv-suggestions"
                className="input-field px-2 py-2 text-xs"
              />
              <datalist id="gv-suggestions">
                {VERSION_SUGGESTIONS.map(v => <option key={v} value={v} />)}
              </datalist>

              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortType)}
                className="input-field px-2 py-2 text-xs"
              >
                <option value="relevance">relevance</option>
                <option value="downloads">downloads</option>
                <option value="updated">updated</option>
              </select>
            </div>
          </div>

          <div
            className="px-3 py-2 text-xs flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}
          >
            {isSearching ? <IconSpinner /> : <IconSearch />}
            {isSearching ? "Searching..." : `${searchHits.length} results`}
            {searchError && (
              <span className="ml-2" style={{ color: "var(--bar-err)" }}>{searchError}</span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {searchHits.map(hit => {
              const active = selectedProject?.project_id === hit.project_id;
              return (
                <button
                  key={hit.project_id}
                  onClick={() => setSelectedProject(hit)}
                  className={`w-full text-left px-3 py-2.5 item-hover ${active ? "item-active" : ""}`}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2.5">
                    {hit.icon_url ? (
                      <img
                        src={hit.icon_url}
                        alt=""
                        className="w-9 h-9 flex-shrink-0"
                        style={{ borderRadius: "var(--radius-sm)" }}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                        style={{ borderRadius: "var(--radius-sm)", background: "var(--bg-active)", color: "var(--text-3)" }}
                      >
                        <IconPackage />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{hit.title}</p>
                      <p className="truncate text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                        {hit.description}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between text-[11px] mt-1.5 pl-[46px]"
                    style={{ color: "var(--text-4)" }}
                  >
                    <span className="uppercase">{hit.project_type}</span>
                    <span>{formatNumber(hit.downloads)} downloads</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              {selectedProject?.icon_url ? (
                <img
                  src={selectedProject.icon_url}
                  alt=""
                  className="w-10 h-10 flex-shrink-0"
                  style={{ borderRadius: "var(--radius-sm)" }}
                />
              ) : (
                <div
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
                  style={{ borderRadius: "var(--radius-sm)", background: "var(--bg-active)", color: "var(--text-3)" }}
                >
                  <IconPackage />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "var(--text-4)" }}>
                  Project
                </p>
                <h1 className="text-lg font-semibold tracking-tight truncate">
                  {selectedProject?.title || "Select a mod or plugin"}
                </h1>
              </div>
            </div>
            <p className="text-sm mt-1.5" style={{ color: "var(--text-2)" }}>
              {selectedProject?.description || "Pick a search result from the left panel to view its versions."}
            </p>
          </div>

          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="min-w-0 flex-1 pr-3">
              <p
                className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest"
                style={{ color: "var(--text-3)" }}
              >
                <IconPackage /> Versions
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-4)" }}>
                {isLoadingVersions ? "Loading..." : `${visibleVersions.length} matching`}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-4)" }}>
                Double-click a version to add it to queue.
              </p>
              <div className="flex gap-2 mt-2">
                <input
                  value={versionSearch}
                  onChange={e => setVersionSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); selectTypedVersion(); }
                  }}
                  placeholder="Type version e.g. 1.20.1 or 0.5.3"
                  className="input-field flex-1 px-2.5 py-1.5 text-xs"
                />
                <button
                  onClick={selectTypedVersion}
                  disabled={!versionSearch.trim() || visibleVersions.length === 0}
                  className="btn px-2.5 py-1.5 text-xs"
                >
                  Pick
                </button>
              </div>
            </div>
            <button
              onClick={enqueueSelected}
              disabled={selectedVersions.length === 0 || !selectedProject}
              className="btn btn-accent flex items-center gap-2 px-3 py-2 text-xs font-medium flex-shrink-0"
            >
              <IconDownload />
              Add ({selectedVersions.length})
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {versionError && (
              <p className="p-4 text-sm" style={{ color: "var(--bar-err)" }}>{versionError}</p>
            )}

            {!isLoadingVersions && visibleVersions.length === 0 && selectedProject && (
              <p className="p-4 text-sm" style={{ color: "var(--text-3)" }}>
                No versions match current filters. Try clearing the version search or changing loader.
              </p>
            )}

            {visibleVersions.map(ver => {
              const file = ver.files.find(f => f.primary) ?? ver.files[0];
              const alreadyInstalled = !!file && installedFiles.has(file.filename);
              const checked = selectedVersionIds.has(ver.id);
              return (
                <label
                  key={ver.id}
                  className="flex items-start gap-3 px-4 py-3 item-hover"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: alreadyInstalled ? "not-allowed" : "pointer",
                    opacity: alreadyInstalled ? 0.45 : 1,
                  }}
                  onDoubleClick={() => {
                    if (!alreadyInstalled) enqueueVersion(ver);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVersion(ver.id)}
                    disabled={alreadyInstalled}
                    className="mt-1 w-4 h-4"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {ver.version_number || ver.name}
                    </p>
                    <p className="truncate text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                      {ver.loaders.join(", ")} · {ver.game_versions.join(", ")}
                    </p>
                    <div
                      className="flex items-center justify-between text-[11px] mt-1"
                      style={{ color: "var(--text-4)" }}
                    >
                      <span>{formatRelativeTime(ver.date_published)}</span>
                      <span>
                        {alreadyInstalled
                          ? "Installed already"
                          : file
                            ? `${file.filename} (${formatBytes(file.size)})`
                            : "no file"}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="panel flex flex-col min-h-0 overflow-hidden">
          <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <p
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest"
              style={{ color: "var(--text-3)" }}
            >
              <IconFolder /> Download Folder
            </p>
            <p className="truncate text-sm mt-1.5" style={{ color: "var(--text-2)" }}>
              {folderLabel}
            </p>
            <button
              onClick={pickFolder}
              className="btn flex items-center gap-2 mt-3 px-3 py-2 text-xs"
            >
              <IconFolder /> Choose Folder
            </button>
            {isTauri && (
              <button
                onClick={openCurrentFolder}
                disabled={!tauriFolderPath}
                className="btn flex items-center gap-2 mt-2 px-3 py-2 text-xs"
              >
                <IconFolderOpen /> Open Folder
              </button>
            )}

            {isTauri && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={activeProfileId}
                    onChange={e => setActiveProfileId(e.target.value)}
                    className="input-field flex-1 px-2 py-1.5 text-xs"
                  >
                    <option value="">No profile selected</option>
                    {profiles.map(profile => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={deleteActiveProfile}
                    disabled={!activeProfileId}
                    className="btn px-2 py-1.5 text-xs"
                  >
                    Delete
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="new profile name"
                    className="input-field flex-1 px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={createProfile}
                    disabled={!newProfileName.trim()}
                    className="btn btn-accent px-2 py-1.5 text-xs"
                  >
                    Create
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-4)" }}>
                  Creating a profile will ask for a folder and bind it to that profile.
                </p>
              </div>
            )}

            <p className="text-[11px] mt-2" style={{ color: "var(--text-4)" }}>
              {isTauri
                ? `Selected: ${tauriFolderPath ? getPathLabel(tauriFolderPath) : "none"}`
                : "Without folder picker, files go to browser downloads."}
            </p>
            {activeProfile && (
              <p className="text-[11px] mt-1" style={{ color: "var(--accent)" }}>
                Active profile: {activeProfile.name}
              </p>
            )}
            {isCheckingInstalled && (
              <p className="text-[11px] mt-1" style={{ color: "var(--text-4)" }}>
                Checking installed files...
              </p>
            )}
          </div>

          {isTauri && tauriFolderPath && (
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <p
                  className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest"
                  style={{ color: "var(--text-3)" }}
                >
                  <IconPackage /> Installed ({installedFiles.size})
                </p>
                <span className="text-[11px]" style={{ color: "var(--text-4)" }}>
                  Quick remove
                </span>
              </div>

              <input
                value={installedSearch}
                onChange={e => setInstalledSearch(e.target.value)}
                placeholder="Search installed files"
                className="input-field w-full mt-2 px-2 py-1.5 text-xs"
              />

              <div className="mt-2 max-h-36 overflow-y-auto overscroll-contain" style={{ borderTop: "1px solid var(--border)" }}>
                {installedVisibleFiles.length === 0 && (
                  <p className="py-2 text-xs" style={{ color: "var(--text-4)" }}>
                    No installed files found.
                  </p>
                )}
                {installedVisibleFiles.map(fileName => (
                  <div
                    key={fileName}
                    className="flex items-center justify-between gap-2 py-1.5"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <p className="truncate text-xs" style={{ color: "var(--text-2)" }}>{fileName}</p>
                    <button
                      onClick={() => removeInstalledFile(fileName)}
                      disabled={isRemovingInstalled}
                      className="btn px-2 py-1 text-[11px] flex items-center gap-1"
                    >
                      <IconTrash /> remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="min-w-0 flex-1 pr-2">
              <p
                className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest"
                style={{ color: "var(--text-3)" }}
              >
                <IconDownload /> Queue ({queueTotal})
              </p>
              <input
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                placeholder="Search in queue"
                className="input-field w-full mt-2 px-2 py-1.5 text-xs"
              />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={queuePaused ? resumeAll : pauseAll}
                className="btn px-2 py-1 text-[11px]"
              >
                {queuePaused ? "Resume all" : "Pause all"}
              </button>
              {queueTotal > 0 && (
                <button
                  onClick={() => setQueueItems([])}
                  className="text-xs transition hover:opacity-80"
                  style={{ color: "var(--text-4)" }}
                >
                  clear all
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {queueItems.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm" style={{ color: "var(--text-3)" }}>No downloads queued.</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-4)" }}>
                  Select versions from a project and click Add.
                </p>
              </div>
            )}

            {queueItems.length > 0 && queueVisibleItems.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm" style={{ color: "var(--text-3)" }}>No queue items match your search.</p>
              </div>
            )}

            {queueVisibleItems.map(item => (
              <div
                key={item.id}
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium flex-1 mr-2">{item.projectTitle}</p>
                  {item.status === "done" && (
                    <span style={{ color: "var(--bar-done)" }}><IconCheck /></span>
                  )}
                  {item.status === "error" && (
                    <span style={{ color: "var(--bar-err)" }}><IconX /></span>
                  )}
                </div>
                <p className="truncate text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  {item.versionName} · {item.fileName}
                </p>

                <div
                  className="mt-2 h-1.5 w-full overflow-hidden"
                  style={{ background: "var(--bar-bg)", borderRadius: "var(--radius-sm)" }}
                >
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      width: `${Math.min(100, Math.max(item.progress + (item.status === "running" ? 6 : 0), item.status === "pending" ? 0 : 4))}%`,
                      background: barColor(item.status),
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                </div>

                <div
                  className="flex items-center justify-between text-[11px] mt-1.5"
                  style={{ color: "var(--text-4)" }}
                >
                  <span className="uppercase">{item.status}</span>
                  <span>{formatBytes(item.size)}</span>
                </div>

                {item.error && (
                  <p className="text-xs mt-1" style={{ color: "var(--bar-err)" }}>{item.error}</p>
                )}

                <div className="flex gap-2 mt-2">
                  {item.status === "running" && !isTauri && (
                    <button onClick={() => cancelItem(item.id)} className="btn px-2 py-1 text-[11px] flex items-center gap-1">
                      <IconX /> cancel
                    </button>
                  )}
                  {(item.status === "error" || item.status === "canceled") && (
                    <button onClick={() => retryItem(item.id)} className="btn px-2 py-1 text-[11px] flex items-center gap-1">
                      <IconRefresh /> retry
                    </button>
                  )}
                  <button onClick={() => removeItem(item.id)} className="btn px-2 py-1 text-[11px] flex items-center gap-1">
                    <IconX /> remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
