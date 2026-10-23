import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Camera,
  ChevronDown,
  FolderKanban,
  History,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  Mic,
  Minus,
  PanelLeft,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { clearRuns, deleteRun, listRuns, saveRun } from "@/lib/runs";
import {
  LS_KEY,
  LS_PROJECT,
  LS_WS,
  applyHeldImages,
  collectParams,
  draftFromDefaults,
  floraRequest,
  formatFloraError,
  formatUsd,
  getTechnique,
  imageSlots,
  isMediaParam,
  isUrlInput,
  listModels,
  listProjects,
  listTechniques,
  listWorkspaces,
  normalizeApiKey,
  pollRun,
  quoteGeneration,
  sameNameVariants,
  startGeneration,
  uploadAsset,
  variantForImageCount,
  workspaceBalance,
  type FloraModel,
  type GenType,
  type ModelParam,
  type ParamDraft,
  type Project,
  type RunSnapshot,
  type Technique,
  type TechniqueInput,
  type Workspace,
  type WorkspaceBalance,
} from "@/lib/flora";
import {
  LS_YOUMIND,
  YOUMIND_IMAGE_ID,
  generateYouMindImage,
  youmindImageModel,
  youmindRequest,
} from "@/lib/youmind";
import {
  PINS_KEY,
  SPEND_WARN,
  THREADS_KEY,
  TYPES,
  TYPE_ORDER,
  countSteps,
  dictationSupported,
  draftList,
  draftText,
  durationLabel,
  emptySnap,
  isAspectParam,
  isChipParam,
  isCountParam,
  isDurationParam,
  isGenType,
  isQualityParam,
  isResolutionParam,
  recipeVariant,
  relativeTime,
  settingChips,
  shortSetting,
  slimEntry,
  startDictation,
  statusLabel,
  withTook,
  type HistoryItem,
  type Notice,
  type RunRecipe,
  type SavedThread,
  type ThreadEntry,
} from "./studio/helpers";
import { ModelPicker } from "./studio/model-picker";
import {
  AspectPicker,
  CompanyLogo,
  Dialog,
  MediaControl,
  ModelSettings,
  NoticeBlock,
  Popover,
  RatioMark,
  StudioMark,
} from "./studio/primitives";
import { RunPanel } from "./studio/result-card";
import { SettingsModal } from "./studio/settings-modal";
import { WorkflowsView } from "./studio/workflows-view";

const STARTER_PROMPTS: Record<GenType, { label: string; prompt: string }[]> = {
  image: [
    {
      label: "Architectural study",
      prompt: "Minimalist brutalist concrete pavilion beside a still alpine lake at dawn, soft fog, 35mm architectural photography",
    },
    {
      label: "Product still life",
      prompt: "Matte anodised aluminium headphones resting on dark slate stone, directional studio rim lighting, macro detail",
    },
    {
      label: "Editorial portrait",
      prompt: "Close-up studio portrait in warm tungsten key light, subtle film grain, shallow depth of field, medium format",
    },
    {
      label: "Botanical macro",
      prompt: "Translucent glass orchid with dew drops under soft diffused skylight, dark botanical studio backdrop",
    },
  ],
  video: [
    {
      label: "Aerial tracking shot",
      prompt: "Slow cinematic drone glide over a misty basalt coastline at sunrise, gentle ocean swell, 24fps film look",
    },
    {
      label: "Studio turntable",
      prompt: "Smooth 360-degree studio camera orbit around a mechanical watch movement with warm reflections",
    },
    {
      label: "Atmospheric street",
      prompt: "Slow push-in down a rain-slick Tokyo alley at night, neon reflections rippling in puddles, shallow focus",
    },
    {
      label: "Natural motion",
      prompt: "Golden hour wind moving through tall alpine meadow grass in slow motion, backlit dust motes",
    },
  ],
  audio: [
    {
      label: "Ambient score",
      prompt: "Warm analogue synth pads with sparse felt piano notes and subtle tape texture, calm cinematic ambience",
    },
    {
      label: "Foley atmosphere",
      prompt: "Gentle evening rain on a skylight with distant rolling thunder and quiet room tone",
    },
    {
      label: "Lo-fi groove",
      prompt: "Crisp downtempo drum loop at 84 BPM with rhodes chords and upright bass",
    },
    {
      label: "Sound design",
      prompt: "Clean futuristic UI confirmation chime with soft crystalline resonance",
    },
  ],
  text: [
    {
      label: "Creative direction",
      prompt: "Write a concise creative brief and shot list for a 30-second launch film for a minimalist smart lamp.",
    },
    {
      label: "Visual prompt expansion",
      prompt: "Turn the concept 'solarpunk observatory in the clouds' into three detailed photographic image prompts.",
    },
    {
      label: "Product copy",
      prompt: "Write crisp hero copy and three feature callouts for a professional darkroom-inspired photo editor.",
    },
    {
      label: "Storyboard treatment",
      prompt: "Outline a 5-scene storyboard for an architectural walkthrough at twilight, including camera movement and lighting.",
    },
  ],
  model3d: [
    {
      label: "Industrial object",
      prompt: "Compact retro-futuristic field recorder with knurled aluminium dials and matte charcoal casing",
    },
    {
      label: "Ceramic vessel",
      prompt: "Hand-thrown stoneware vase with ribbed matte black glaze and organic silhouette",
    },
    {
      label: "Sculptural chair",
      prompt: "Bent walnut lounge chair withbouclé cushions, clean Scandinavian joinery",
    },
    {
      label: "Sci-fi prop",
      prompt: "Modular orbital survey probe with folded solar panels and anodized titanium housing",
    },
  ],
};

export function FloraConsole() {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [youmindInput, setYoumindInput] = useState("");
  const [youmindKey, setYoumindKey] = useState<string | null>(null);
  const [youmindBusy, setYoumindBusy] = useState(false);
  const [showYoumind, setShowYoumind] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [balance, setBalance] = useState<WorkspaceBalance | null>(null);
  const [balanceState, setBalanceState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [balanceTick, setBalanceTick] = useState(0);
  const [projectId, setProjectId] = useState("");
  const [loadingWs, setLoadingWs] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [connNotice, setConnNotice] = useState<Notice>(null);

  const [tab, setTab] = useState<"generate" | "techniques">("generate");
  const [genType, setGenType] = useState<GenType>("image");
  const [models, setModels] = useState<FloraModel[]>([]);
  const [modelsNotice, setModelsNotice] = useState<Notice>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelId, setModelId] = useState("");
  const [heldImages, setHeldImages] = useState<string[]>([]);
  const [paramDraft, setParamDraft] = useState<Record<string, ParamDraft>>({});
  const [busyParam, setBusyParam] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [quote, setQuote] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Modals & Popovers
  const [modal, setModal] = useState<null | "model" | "refs" | "setup" | "history">(null);
  const [popover, setPopover] = useState<null | "aspect" | "duration" | "batch" | "count">(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [spendAsk, setSpendAsk] = useState<{ recipe: RunRecipe; cost: number; copies: number } | null>(null);

  const [batch, setBatch] = useState(1);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [pinsReady, setPinsReady] = useState(false);
  const [canDictate, setCanDictate] = useState(false);

  const [running, setRunning] = useState(false);
  const [actionNotice, setActionNotice] = useState<Notice>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [threadEntries, setThreadEntries] = useState<ThreadEntry[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<SavedThread[]>([]);
  const [threadsReady, setThreadsReady] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const { user } = useCurrentUserState();

  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [techLoading, setTechLoading] = useState(false);
  const [techNotice, setTechNotice] = useState<Notice>(null);
  const [techQuery, setTechQuery] = useState("");
  const [slugDraft, setSlugDraft] = useState("");
  const [activeTechnique, setActiveTechnique] = useState<Technique | null>(null);
  const [techInputs, setTechInputs] = useState<TechniqueInput[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [techDetailLoading, setTechDetailLoading] = useState(false);

  const abortRef = useRef<Map<string, AbortController>>(new Map());
  const inflight = useRef(0);
  const resumedRuns = useRef(false);
  const entriesRef = useRef(threadEntries);
  entriesRef.current = threadEntries;
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const balanceWorkspace = useRef("");
  const alive = useRef(true);

  useEffect(() => {
    setCanDictate(dictationSupported());
  }, []);

  useEffect(() => {
    alive.current = true;
    const key = normalizeApiKey(localStorage.getItem(LS_KEY) ?? "");
    const youmind = normalizeApiKey(localStorage.getItem(LS_YOUMIND) ?? "");
    const storedWs = localStorage.getItem(LS_WS) ?? "";
    const storedProject = localStorage.getItem(LS_PROJECT) ?? "";
    if (youmind) {
      setYoumindInput(youmind);
      setYoumindKey(youmind);
    }
    if (key) {
      setApiKeyInput(key);
      setSavedKey(key);
      void loadConnection(key, storedWs, storedProject);
    }
    return () => {
      alive.current = false;
      for (const controller of abortRef.current.values()) controller.abort();
    };
    // Boot once from localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listRuns()
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(THREADS_KEY) || "") as {
        current?: ThreadEntry[];
        archived?: SavedThread[];
      };
      if (Array.isArray(parsed.current)) setThreadEntries(parsed.current);
      if (Array.isArray(parsed.archived)) setArchivedThreads(parsed.archived);
    } catch {
      // No saved threads yet.
    }
    setThreadsReady(true);
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PINS_KEY) || "[]") as unknown;
      if (Array.isArray(parsed)) setPins(parsed.filter((item): item is string => typeof item === "string"));
    } catch {
      // No pins yet.
    }
    setPinsReady(true);
  }, []);

  useEffect(() => {
    if (!pinsReady) return;
    localStorage.setItem(PINS_KEY, JSON.stringify(pins));
  }, [pins, pinsReady]);

  useEffect(() => {
    if (!threadsReady) return;
    try {
      localStorage.setItem(
        THREADS_KEY,
        JSON.stringify({
          current: threadEntries.map(slimEntry),
          archived: archivedThreads.map((thread) => ({
            ...thread,
            entries: thread.entries.map(slimEntry),
          })),
        }),
      );
    } catch {
      // Storage full; keep in-memory state.
    }
  }, [threadEntries, archivedThreads, threadsReady]);

  useEffect(() => {
    const current = models.find((model) => model.id === modelId && model.type === genType);
    if (!current) return;
    const peers = sameNameVariants(models, current);
    if (peers.length < 2) return;
    const next = variantForImageCount(peers, heldImages.length);
    if (!next) return;
    if (next.id !== modelId) setModelId(next.id);
    setParamDraft((currentDraft) => applyHeldImages(next, heldImages, currentDraft));
  }, [heldImages, modelId, models, genType]);

  useEffect(() => {
    if (!savedKey || !workspaceId) {
      balanceWorkspace.current = "";
      setBalance(null);
      setBalanceState("idle");
      return;
    }
    let cancelled = false;
    const switched = balanceWorkspace.current !== workspaceId;
    balanceWorkspace.current = workspaceId;
    if (switched) {
      setBalance(null);
      setBalanceState("loading");
    }
    void workspaceBalance(savedKey, workspaceId)
      .then((next) => {
        if (cancelled) return;
        setBalance(next);
        setBalanceState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setBalance(null);
        setBalanceState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [savedKey, workspaceId, balanceTick]);

  // Smooth auto-growing prompt textarea
  useLayoutEffect(() => {
    const el = promptRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, 52), 180);
    el.style.height = `${nextHeight}px`;
  }, [prompt, tab]);

  useEffect(() => {
    if (!savedKey) {
      setModels(youmindKey ? [youmindImageModel()] : []);
      setLoadingModels(false);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    setModelsNotice(null);
    void Promise.all(
      TYPE_ORDER.map((type) =>
        listModels(savedKey, type).then(
          (list) => list,
          () => [] as FloraModel[],
        ),
      ),
    )
      .then((lists) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: FloraModel[] = [];
        lists.forEach((list, index) => {
          for (const model of list) {
            const typed = model.type || TYPE_ORDER[index];
            const key = `${typed}:${model.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(typed === model.type ? model : { ...model, type: typed });
          }
        });
        const next = merged.filter((model) => model.id !== YOUMIND_IMAGE_ID);
        if (youmindKey) next.push(youmindImageModel());
        setModels(next);
        if (!next.length) {
          setModelsNotice({ message: "No models found for this key.", cors: false });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setModels(youmindKey ? [youmindImageModel()] : []);
        setModelsNotice(formatFloraError(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [savedKey, youmindKey]);

  async function loadConnection(key: string, preferWs = "", preferProject = "") {
    setLoadingWs(true);
    setConnNotice(null);
    try {
      const list = await listWorkspaces(key);
      if (!alive.current) return;
      setWorkspaces(list);
      const ws = list.some((item) => item.id === preferWs) ? preferWs : (list[0]?.id ?? "");
      setWorkspaceId(ws);
      if (ws) localStorage.setItem(LS_WS, ws);
      if (!list.length) {
        setProjects([]);
        setProjectId("");
        setConnNotice({
          message:
            "This key has no workspace access. Check its permissions in Flora under Settings → API Keys.",
          cors: false,
        });
        return;
      }
      await loadProjects(key, ws, preferProject);
    } catch (error) {
      if (!alive.current) return;
      setWorkspaces([]);
      setProjects([]);
      setConnNotice(formatFloraError(error));
    } finally {
      if (alive.current) setLoadingWs(false);
    }
  }

  async function loadProjects(key: string, ws: string, preferProject = "") {
    setLoadingProjects(true);
    try {
      const list = await listProjects(key, ws);
      if (!alive.current) return;
      setProjects(list);
      const project = list.some((item) => item.id === preferProject)
        ? preferProject
        : (list[0]?.id ?? "");
      setProjectId(project);
      if (project) localStorage.setItem(LS_PROJECT, project);
      else localStorage.removeItem(LS_PROJECT);
    } catch (error) {
      if (!alive.current) return;
      setProjects([]);
      setProjectId("");
      setConnNotice(formatFloraError(error));
    } finally {
      if (alive.current) setLoadingProjects(false);
    }
  }

  function rememberKey(key: string) {
    localStorage.setItem(LS_KEY, key);
    setSavedKey(key);
    setApiKeyInput(key);
  }

  async function saveAndConnect() {
    const key = normalizeApiKey(apiKeyInput);
    if (!key) {
      setConnNotice({ message: "Paste your Flora API key first.", cors: false });
      return;
    }
    rememberKey(key);
    await loadConnection(key, workspaceId, projectId);
  }

  function clearKey() {
    stopAll();
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_WS);
    localStorage.removeItem(LS_PROJECT);
    setApiKeyInput("");
    setSavedKey(null);
    setShowKey(false);
    setWorkspaces([]);
    setProjects([]);
    setWorkspaceId("");
    setProjectId("");
    setModels(youmindKey ? [youmindImageModel()] : []);
    setConnNotice(null);
    setModelsNotice(null);
    setRunning(false);
  }

  async function saveYoumind() {
    const key = normalizeApiKey(youmindInput);
    if (!key.startsWith("sk-ym-")) {
      setConnNotice({ message: "Paste a YouMind key starting with sk-ym-.", cors: false });
      return;
    }
    setYoumindBusy(true);
    setConnNotice(null);
    try {
      await youmindRequest(key, "getDefaultBoard", {});
      if (!alive.current) return;
      localStorage.setItem(LS_YOUMIND, key);
      setYoumindKey(key);
      setYoumindInput(key);
    } catch (error) {
      if (alive.current) setConnNotice(formatFloraError(error));
    } finally {
      if (alive.current) setYoumindBusy(false);
    }
  }

  function clearYoumind() {
    localStorage.removeItem(LS_YOUMIND);
    setYoumindInput("");
    setYoumindKey(null);
    setShowYoumind(false);
    if (modelId === YOUMIND_IMAGE_ID) setModelId("");
  }

  async function onWorkspace(id: string) {
    setWorkspaceId(id);
    setProjectId("");
    setProjects([]);
    if (id) localStorage.setItem(LS_WS, id);
    if (!savedKey || !id) return;
    await loadProjects(savedKey, id);
  }

  function onProject(id: string) {
    setProjectId(id);
    if (id) localStorage.setItem(LS_PROJECT, id);
  }

  function pushHistory(item: HistoryItem) {
    setHistory((current) => [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 40));
    if (!user) return;
    void saveRun({ data: { ...item, snap: { ...item.snap, raw: null } } }).catch(() => {});
  }

  function stopAll() {
    for (const controller of abortRef.current.values()) controller.abort();
    abortRef.current.clear();
    inflight.current = 0;
    setBusyIds([]);
    setRunning(false);
  }

  function stopEntry(entryId: string) {
    abortRef.current.get(entryId)?.abort();
  }

  function trackRun(entryId: string) {
    const controller = new AbortController();
    abortRef.current.set(entryId, controller);
    inflight.current += 1;
    setRunning(true);
    setActionNotice(null);
    return controller;
  }

  function finishTracked(entryId: string) {
    const had = abortRef.current.delete(entryId);
    if (!alive.current) return;
    if (had) inflight.current = Math.max(0, inflight.current - 1);
    setBusyIds((current) => current.filter((id) => id !== entryId));
    if (inflight.current === 0) setRunning(false);
  }

  async function watch(
    controller: AbortController,
    key: string,
    created: unknown,
    meta: {
      title: string;
      typeLabel: string;
      prefer?: GenType;
      recipe?: RunRecipe;
      entryId: string;
      startedAt?: number;
    },
  ) {
    const startedAt = meta.startedAt ?? Date.now();
    const writeEntry = (snap: RunSnapshot) => {
      const next = withTook(snap, startedAt);
      setThreadEntries((current) =>
        current.map((entry) => (entry.id === meta.entryId ? { ...entry, snap: next } : entry)),
      );
      return next;
    };
    try {
      const finalSnap = await pollRun(key, created, {
        signal: controller.signal,
        prefer: meta.prefer,
        onUpdate: (snapshot) => {
          if (alive.current) {
            writeEntry(snapshot);
          }
        },
      });
      if (!alive.current) return;
      let shown = finalSnap;
      const missingCost = shown.cost == null || shown.cost <= 0;
      if (shown.status === "completed" && missingCost) {
        const remembered = meta.recipe?.quotedCost;
        let priced = remembered != null && remembered > 0 ? remembered : null;
        if (priced == null && meta.recipe?.modelId && workspaceId && projectId) {
          try {
            priced = await quoteGeneration(key, {
              type: meta.recipe.type,
              prompt: meta.recipe.prompt || meta.title,
              workspaceId,
              projectId,
              model: meta.recipe.modelId,
              params: meta.recipe.params,
            });
          } catch {
            priced = null;
          }
        }
        if (priced == null || priced <= 0) {
          const listed =
            models.find((model) => model.id === meta.recipe?.modelId && model.type === meta.recipe?.type)
              ?.baseCost ?? null;
          if (listed != null && listed > 0) priced = listed;
        }
        if (priced != null && priced > 0) shown = { ...shown, cost: priced };
      }
      shown = withTook(shown, startedAt);
      writeEntry(shown);
      pushHistory({
        id: shown.runId || crypto.randomUUID(),
        title: meta.title,
        typeLabel: meta.typeLabel,
        status: shown.status,
        cost: shown.cost,
        at: Date.now(),
        snap: shown,
        recipe: meta.recipe,
      });
      if (shown.status === "failed") {
        setActionNotice({ message: shown.error || "The generation failed.", cors: false });
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Error && error.name === "AbortError") return;
      setActionNotice(formatFloraError(error));
    } finally {
      finishTracked(meta.entryId);
      if (alive.current) setBalanceTick((value) => value + 1);
    }
  }

  async function watchYouMind(
    controller: AbortController,
    key: string,
    recipe: RunRecipe,
    entryId: string,
    chatId = "",
    startedAt = Date.now(),
  ) {
    const writeEntry = (snap: RunSnapshot) => {
      const next = withTook(snap, startedAt);
      setThreadEntries((current) =>
        current.map((entry) => (entry.id === entryId ? { ...entry, snap: next } : entry)),
      );
      return next;
    };
    try {
      const finalSnap = await generateYouMindImage(key, recipe.prompt, {
        signal: controller.signal,
        chatId,
        onUpdate: (snapshot) => {
          if (!alive.current) return;
          writeEntry(snapshot);
        },
      });
      if (!alive.current) return;
      const shown = withTook(finalSnap, startedAt);
      writeEntry(shown);
      pushHistory({
        id: shown.runId || crypto.randomUUID(),
        title: recipe.prompt,
        typeLabel: recipe.type,
        status: shown.status,
        cost: shown.cost,
        at: Date.now(),
        snap: shown,
        recipe,
      });
      if (shown.status === "failed") {
        setActionNotice({ message: shown.error || "The generation failed.", cors: false });
      }
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Error && error.name === "AbortError") return;
      const message = formatFloraError(error).message;
      setActionNotice(formatFloraError(error));
      setThreadEntries((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                snap: {
                  ...entry.snap,
                  status: "failed",
                  error: message,
                  took: entry.startedAt
                    ? Math.max(1, Math.round((Date.now() - entry.startedAt) / 1000))
                    : entry.snap.took,
                },
              }
            : entry,
        ),
      );
    } finally {
      finishTracked(entryId);
    }
  }

  useEffect(() => {
    if (!threadsReady || resumedRuns.current) return;
    if (!savedKey && !youmindKey) return;
    resumedRuns.current = true;
    for (const entry of entriesRef.current) {
      const status = entry.snap.status;
      if (status !== "running" && status !== "pending") continue;
      const youmindChat = entry.snap.runId.startsWith("ym_") ? entry.snap.runId.slice(3) : "";
      if (youmindChat) {
        if (!youmindKey || !entry.recipe) continue;
        const controller = trackRun(entry.id);
        void watchYouMind(controller, youmindKey, entry.recipe, entry.id, youmindChat, entry.startedAt);
        continue;
      }
      if (!savedKey || !entry.snap.runId) continue;
      const controller = trackRun(entry.id);
      void watch(
        controller,
        savedKey,
        {
          run_id: entry.snap.runId,
          status,
          poll_url: `https://app.flora.ai/api/v1/runs/${encodeURIComponent(entry.snap.runId)}`,
        },
        {
          title: entry.recipe?.prompt || "Run",
          typeLabel: entry.recipe?.type || "image",
          prefer: entry.recipe?.type,
          recipe: entry.recipe ?? undefined,
          entryId: entry.id,
          startedAt: entry.startedAt,
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadsReady, savedKey, youmindKey]);

  useEffect(() => {
    if (modelId === YOUMIND_IMAGE_ID) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const text = prompt.trim();
    const selected = models.find((model) => model.id === modelId && model.type === genType);
    if (!savedKey || !workspaceId || !projectId || !modelId || !text || !selected) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    const controller = new AbortController();
    setQuote(null);
    setQuoting(false);
    const timer = window.setTimeout(() => {
      setQuoting(true);
      void quoteGeneration(
        savedKey,
        {
          type: genType,
          prompt: text,
          workspaceId,
          projectId,
          model: modelId,
          params: collectParams(selected, paramDraft),
        },
        controller.signal,
      )
        .then((cost) => {
          if (!controller.signal.aborted) setQuote(cost);
        })
        .catch(() => {
          if (!controller.signal.aborted) setQuote(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setQuoting(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [savedKey, workspaceId, projectId, modelId, genType, prompt, paramDraft, models]);

  async function runGeneration(next: RunRecipe) {
    const youmind = next.modelId === YOUMIND_IMAGE_ID;
    const key = youmind ? youmindKey : savedKey;
    if (!key) {
      setActionNotice({
        message: youmind
          ? "Connect your YouMind API key in Settings to generate."
          : "Connect your Flora API key in Settings to generate.",
        cors: false,
      });
      setModal("setup");
      return;
    }
    if (!youmind && (!workspaceId || !projectId)) {
      setActionNotice({ message: "Select a workspace and project in Settings.", cors: false });
      setModal("setup");
      return;
    }
    setPrompt(next.prompt);
    setGenType(next.type);
    setModelId(next.modelId);
    setParamDraft(next.draft);
    const entryId = crypto.randomUUID();
    const startedAt = Date.now();
    setActiveEntryId(entryId);
    setBusyIds((current) => [entryId, ...current]);
    setThreadEntries((current) => [{ id: entryId, recipe: next, snap: emptySnap(), startedAt }, ...current]);
    const controller = trackRun(entryId);
    try {
      if (youmind) {
        await watchYouMind(controller, key, next, entryId, "", startedAt);
        return;
      }
      const created = await startGeneration(
        key,
        {
          type: next.type,
          prompt: next.prompt,
          workspaceId,
          projectId,
          model: next.modelId || undefined,
          params: next.params,
        },
        controller.signal,
      );
      await watch(controller, key, created, {
        title: next.prompt,
        typeLabel: next.type,
        prefer: next.type,
        recipe: next,
        entryId,
        startedAt,
      });
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Error && error.name === "AbortError") {
        finishTracked(entryId);
        return;
      }
      setActionNotice(formatFloraError(error));
      setThreadEntries((current) =>
        current.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                snap: {
                  ...entry.snap,
                  status: "failed",
                  error: formatFloraError(error).message,
                  took: entry.startedAt
                    ? Math.max(1, Math.round((Date.now() - entry.startedAt) / 1000))
                    : entry.snap.took,
                },
              }
            : entry,
        ),
      );
      setBusyIds((current) => current.filter((id) => id !== entryId));
      finishTracked(entryId);
    } finally {
      if (alive.current) setActiveEntryId((current) => (current === entryId ? null : current));
    }
  }

  function currentRecipe(): RunRecipe | null {
    const text = prompt.trim();
    if (!text) return null;
    const selected = models.find((model) => model.id === modelId && model.type === genType) ?? null;
    return {
      prompt: text,
      modelId,
      modelName: selected?.name || "Workspace default",
      company: selected?.company || "",
      type: genType,
      params: collectParams(selected ?? undefined, paramDraft),
      draft: { ...paramDraft },
      chips: settingChips(selected, paramDraft),
      quotedCost: quote,
    };
  }

  function confirmRun(next: RunRecipe, copies = 1) {
    const live = next.modelId === modelId && next.type === genType ? quote : null;
    const listed =
      models.find((model) => model.id === next.modelId && model.type === next.type)?.baseCost ?? null;
    const each = live ?? listed;
    const total = each == null ? null : each * copies;
    if (total != null && total >= SPEND_WARN) {
      setSpendAsk({ recipe: next, cost: total, copies });
      return;
    }
    if (copies > 1) void runMany(Array.from({ length: copies }, (_, index) => recipeVariant(next, index)));
    else void runGeneration(next);
  }

  async function runMany(recipes: RunRecipe[]) {
    const first = recipes[0];
    const youmind = first?.modelId === YOUMIND_IMAGE_ID;
    const key = youmind ? youmindKey : savedKey;
    if (!key) {
      setActionNotice({
        message: youmind
          ? "Connect your YouMind API key in Settings to generate."
          : "Connect your Flora API key in Settings to generate.",
        cors: false,
      });
      setModal("setup");
      return;
    }
    if (!first || (!youmind && (!workspaceId || !projectId))) {
      setActionNotice({ message: "Select a workspace and project in Settings.", cors: false });
      setModal("setup");
      return;
    }
    const jobs = recipes.map((next) => ({ next, entryId: crypto.randomUUID(), startedAt: Date.now() }));
    setPrompt(first.prompt);
    setGenType(first.type);
    setModelId(first.modelId);
    setParamDraft(first.draft);
    setActiveEntryId(jobs[0].entryId);
    setBusyIds((current) => [...jobs.map((job) => job.entryId), ...current]);
    setThreadEntries((current) => [
      ...jobs.map((job) => ({
        id: job.entryId,
        recipe: job.next,
        snap: emptySnap(),
        startedAt: job.startedAt,
      })),
      ...current,
    ]);
    await Promise.all(
      jobs.map(async (job) => {
        const controller = trackRun(job.entryId);
        try {
          if (job.next.modelId === YOUMIND_IMAGE_ID) {
            await watchYouMind(controller, key, job.next, job.entryId, "", job.startedAt);
            return;
          }
          const created = await startGeneration(
            key,
            {
              type: job.next.type,
              prompt: job.next.prompt,
              workspaceId,
              projectId,
              model: job.next.modelId || undefined,
              params: job.next.params,
            },
            controller.signal,
          );
          await watch(controller, key, created, {
            title: job.next.prompt,
            typeLabel: job.next.type,
            prefer: job.next.type,
            recipe: job.next,
            entryId: job.entryId,
            startedAt: job.startedAt,
          });
        } catch (error) {
          if (!alive.current) return;
          if (error instanceof Error && error.name === "AbortError") {
            finishTracked(job.entryId);
            return;
          }
          setActionNotice(formatFloraError(error));
          setThreadEntries((current) =>
            current.map((entry) =>
              entry.id === job.entryId
                ? {
                    ...entry,
                    snap: {
                      ...entry.snap,
                      status: "failed",
                      error: formatFloraError(error).message,
                      took: entry.startedAt
                        ? Math.max(1, Math.round((Date.now() - entry.startedAt) / 1000))
                        : entry.snap.took,
                    },
                  }
                : entry,
            ),
          );
          setBusyIds((current) => current.filter((id) => id !== job.entryId));
          finishTracked(job.entryId);
        }
      }),
    );
  }

  async function generate() {
    const next = currentRecipe();
    if (!next) {
      setActionNotice({
        message: savedKey || youmindKey ? "Enter a prompt to generate." : "Connect an API key in Settings to begin.",
        cors: false,
      });
      if (!savedKey && !youmindKey) setModal("setup");
      return;
    }
    if (next.modelId === YOUMIND_IMAGE_ID && !youmindKey) {
      setActionNotice({ message: "Add a YouMind key in Settings first.", cors: false });
      setModal("setup");
      return;
    }
    if (refParam?.required && refUrls.length === 0) {
      setActionNotice({ message: "Attach a reference image for this model.", cors: false });
      setModal("refs");
      return;
    }
    confirmRun(next, genType === "image" ? batch : 1);
  }

  function rerun(source: RunRecipe) {
    confirmRun(source);
  }

  function togglePin(ids: string[], pinned: boolean) {
    setPins((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (pinned) next.add(id);
        else next.delete(id);
      }
      return [...next];
    });
  }

  function applySeed(seed: string, source: RunRecipe | null) {
    const current = models.find((model) => model.id === modelId && model.type === genType) ?? null;
    const fromResult = source
      ? (models.find((model) => model.id === source.modelId && model.type === source.type) ?? null)
      : null;
    const hasSeed = (model: FloraModel | null) =>
      Boolean(model?.params.some((param) => param.type === "seed" || /seed/i.test(param.name)));
    const model = hasSeed(current) ? current : hasSeed(fromResult) ? fromResult : current;
    if (model && (model.id !== modelId || model.type !== genType)) {
      if (isGenType(model.type)) setGenType(model.type);
      setModelId(model.id);
    }
    const seedParam = model?.params.find((param) => param.type === "seed" || /seed/i.test(param.name));
    setParamDraft((draft) => ({ ...draft, [seedParam?.name ?? "seed"]: seed }));
    setMoreOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deletePiece(entryId: string, index: number) {
    setThreadEntries((current) =>
      current.flatMap((entry) => {
        if (entry.id !== entryId) return [entry];
        const pieces = entry.snap.pieces.filter((_, pieceIndex) => pieceIndex !== index);
        if (!pieces.length) return [];
        return [{ ...entry, snap: { ...entry.snap, pieces } }];
      }),
    );
  }

  function startNewThread() {
    stopAll();
    setActiveEntryId(null);
    if (threadEntries.length) {
      const title = threadEntries.find((entry) => entry.recipe?.prompt)?.recipe?.prompt || "Untitled session";
      setArchivedThreads((threads) =>
        [{ id: crypto.randomUUID(), title, updatedAt: Date.now(), entries: threadEntries }, ...threads].slice(
          0,
          30,
        ),
      );
    }
    setThreadEntries([]);
    setPrompt("");
    setActionNotice(null);
    setTab("generate");
  }

  function openThread(thread: SavedThread) {
    setArchivedThreads((threads) => {
      const without = threads.filter((item) => item.id !== thread.id);
      if (!threadEntries.length) return without;
      const title = threadEntries.find((entry) => entry.recipe?.prompt)?.recipe?.prompt || "Untitled session";
      return [
        { id: crypto.randomUUID(), title, updatedAt: Date.now(), entries: threadEntries },
        ...without,
      ].slice(0, 30);
    });
    setThreadEntries(thread.entries);
    setActionNotice(null);
    setModal(null);
    setTab("generate");
  }

  function deleteArchived(id: string) {
    setArchivedThreads((threads) => threads.filter((thread) => thread.id !== id));
  }

  async function deleteSaved(id: string) {
    const previous = history;
    setHistory((items) => items.filter((item) => item.id !== id));
    if (!user) return;
    try {
      await deleteRun({ data: { id } });
    } catch {
      setHistory(previous);
      setActionNotice({ message: "Couldn’t delete this run.", cors: false });
    }
  }

  async function clearHistory() {
    const previousThreads = archivedThreads;
    const previousRuns = history;
    setArchivedThreads([]);
    setHistory([]);
    if (!user || !previousRuns.length) return;
    try {
      await clearRuns();
    } catch {
      setArchivedThreads(previousThreads);
      setHistory(previousRuns);
      setActionNotice({ message: "Couldn’t clear history.", cors: false });
    }
  }

  async function loadTechniqueList() {
    if (!savedKey) {
      setTechNotice({ message: "Connect your Flora API key in Settings first.", cors: false });
      return;
    }
    setTechLoading(true);
    setTechNotice(null);
    try {
      const list = await listTechniques(savedKey);
      setTechniques(list);
      if (!list.length) {
        setTechNotice({ message: "No workflows found for this key.", cors: false });
      }
      const key = savedKey;
      const missing = list.filter((item) => item.slug && (!item.description || item.cost == null));
      let index = 0;
      const worker = async () => {
        while (index < missing.length) {
          const item = missing[index];
          index += 1;
          if (!item?.slug) continue;
          try {
            const full = await getTechnique(key, item.slug);
            if (!alive.current) return;
            setTechniques((current) =>
              current.map((technique) => (technique.slug === item.slug ? { ...technique, ...full } : technique)),
            );
          } catch {
            // Keep summary item if detail call fails.
          }
        }
      };
      void Promise.all(Array.from({ length: 4 }, () => worker()));
    } catch (error) {
      setTechNotice(formatFloraError(error));
    } finally {
      setTechLoading(false);
    }
  }

  async function selectTechnique(slug: string) {
    const cleaned = slug.trim();
    setSlugDraft(cleaned);
    if (!cleaned) return;
    if (!savedKey) {
      setTechNotice({ message: "Connect your Flora API key in Settings first.", cors: false });
      return;
    }
    setTechDetailLoading(true);
    setTechNotice(null);
    try {
      const full = await getTechnique(savedKey, cleaned);
      setActiveTechnique(full);
      setTechInputs(full.inputs);
      setInputValues({});
      setTechniques((current) => {
        if (!current.some((item) => item.slug === full.slug)) return current;
        return current.map((item) => (item.slug === full.slug ? { ...item, ...full } : item));
      });
    } catch (error) {
      setActiveTechnique(null);
      setTechInputs([]);
      setTechNotice(formatFloraError(error));
    } finally {
      setTechDetailLoading(false);
    }
  }

  async function runTechnique() {
    if (!savedKey) {
      setTechNotice({ message: "Connect your Flora API key in Settings first.", cors: false });
      setModal("setup");
      return;
    }
    const slug = (activeTechnique?.slug || slugDraft).trim();
    if (!slug) {
      setTechNotice({ message: "Enter or select a workflow slug.", cors: false });
      return;
    }
    if (!techInputs.length) {
      setTechNotice({ message: "Load the workflow inputs first.", cors: false });
      return;
    }
    const inputs = techInputs.map((input) => ({
      id: input.id,
      type: input.type,
      value: (inputValues[input.id] ?? "").trim(),
    }));
    for (const input of inputs) {
      const label = techInputs.find((item) => item.id === input.id)?.name || input.id;
      if (!input.value) {
        setTechNotice({ message: `${label} is required.`, cors: false });
        return;
      }
      if (isUrlInput(input.type) && !input.value.startsWith("https://")) {
        setTechNotice({ message: `${label} must be an https:// URL.`, cors: false });
        return;
      }
    }
    const entryId = crypto.randomUUID();
    const startedAt = Date.now();
    const controller = trackRun(entryId);
    setActiveEntryId(entryId);
    setBusyIds((current) => [entryId, ...current]);
    setThreadEntries((current) => [
      {
        id: entryId,
        recipe: {
          prompt: activeTechnique?.name || slug,
          modelId: "",
          modelName: activeTechnique?.name || slug,
          company: "",
          type: "image",
          params: {},
          draft: {},
          chips: ["Workflow"],
        },
        snap: emptySnap(),
        startedAt,
      },
      ...current,
    ]);
    // Switch to Create canvas so user watches the live workflow run immediately
    setTab("generate");
    try {
      const created = await floraRequest(savedKey, `/techniques/${encodeURIComponent(slug)}/runs`, {
        method: "POST",
        body: JSON.stringify({ inputs, mode: "async" }),
        signal: controller.signal,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      await watch(controller, savedKey, created, {
        title: activeTechnique?.name || slug,
        typeLabel: slug,
        entryId,
        startedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        finishTracked(entryId);
        return;
      }
      if (alive.current) setActionNotice(formatFloraError(error));
      setBusyIds((current) => current.filter((id) => id !== entryId));
      finishTracked(entryId);
    } finally {
      if (alive.current) setActiveEntryId((current) => (current === entryId ? null : current));
    }
  }

  // Derived active model & parameter metadata
  const dirty = normalizeApiKey(apiKeyInput) !== (savedKey ?? "");
  const activeModel = models.find((model) => model.id === modelId && model.type === genType) ?? null;
  const aspectParam =
    activeModel?.params.find((param) => param.options.length > 0 && isAspectParam(param)) ?? null;
  const resolutionParam = activeModel?.params.find((param) => isResolutionParam(param)) ?? null;
  const durationParam = activeModel?.params.find((param) => isDurationParam(param)) ?? null;
  const countParam = activeModel?.params.find((param) => isCountParam(param)) ?? null;
  const qualityParams = activeModel?.params.filter((param) => isQualityParam(param)) ?? [];
  const mediaParams = activeModel?.params.filter(isMediaParam) ?? [];
  const namePeers = activeModel ? sameNameVariants(models, activeModel) : [];
  const merged = namePeers.length > 1;
  const groupRefMax = merged ? Math.max(namePeers.length - 1, ...namePeers.map(imageSlots)) : 0;
  const ownRefParam =
    mediaParams.find((param) => /image/i.test(`${param.name} ${param.label}`)) ?? mediaParams[0] ?? null;
  const refParam: ModelParam | null =
    merged && groupRefMax > 0
      ? {
          name: "image_urls",
          type: "string[]",
          required: false,
          label: "Reference images",
          description: "",
          defaultValue: null,
          min: null,
          max: groupRefMax,
          options: [],
          properties: [],
        }
      : ownRefParam;

  const refUrls = merged
    ? heldImages
    : refParam
      ? refParam.type === "string[]"
        ? draftList(paramDraft[refParam.name])
        : draftText(paramDraft[refParam.name])
          ? [draftText(paramDraft[refParam.name])]
          : []
      : [];
  const refMax = merged ? groupRefMax : refParam ? (refParam.type === "string[]" ? (refParam.max ?? 14) : 1) : 0;

  const aspectValue = aspectParam
    ? draftText(paramDraft[aspectParam.name]) ||
      (aspectParam.defaultValue == null ? "" : String(aspectParam.defaultValue))
    : "";
  const resolutionValue = resolutionParam
    ? draftText(paramDraft[resolutionParam.name]) ||
      (resolutionParam.defaultValue == null
        ? (resolutionParam.options[0]?.value ?? "")
        : String(resolutionParam.defaultValue))
    : "";
  const durationValue = durationParam
    ? draftText(paramDraft[durationParam.name]) ||
      (durationParam.defaultValue == null
        ? (durationParam.options[0]?.value ?? "")
        : String(durationParam.defaultValue))
    : "";
  const countList = countParam ? countSteps(countParam) : [];
  const countValue = countParam
    ? draftText(paramDraft[countParam.name]) ||
      (countParam.defaultValue == null ? (countList[0] ?? "1") : String(countParam.defaultValue))
    : "1";
  const countIndex = Math.max(0, countList.indexOf(countValue));

  function writeParam(name: string, value: ParamDraft | undefined) {
    setParamDraft((current) => {
      const next = { ...current };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return next;
    });
  }

  function removeRefUrl(url: string) {
    if (merged) {
      setHeldImages((current) => current.filter((item) => item !== url));
      return;
    }
    if (!refParam) return;
    setParamDraft((current) => {
      if (refParam.type === "string[]") {
        const prev = Array.isArray(current[refParam.name]) ? (current[refParam.name] as string[]) : [];
        return { ...current, [refParam.name]: prev.filter((item) => item !== url) };
      }
      const next = { ...current };
      delete next[refParam.name];
      return next;
    });
  }

  function useAsReference(url: string) {
    if (!url.startsWith("https://")) {
      setActionNotice({ message: "This image has no link yet.", cors: false });
      return;
    }
    const imageParam = refParam && /image/i.test(`${refParam.name} ${refParam.label}`) ? refParam : null;
    const max = imageParam
      ? merged
        ? refMax
        : imageParam.type === "string[]"
          ? (imageParam.max ?? 14)
          : 1
      : 4;
    const push = (current: string[]) => {
      if (current.includes(url)) return current;
      if (max <= 1) return [url];
      if (current.length < max) return [...current, url];
      return [...current.slice(0, max - 1), url];
    };
    const already = (merged || !imageParam ? heldImages : refUrls).includes(url);
    if (already) {
      setActionNotice({ message: "This image is already attached as a reference.", cors: false });
      return;
    }
    setHeldImages(push);
    if (imageParam && !merged) {
      setParamDraft((current) => {
        if (imageParam.type === "string[]") {
          const prev = Array.isArray(current[imageParam.name]) ? (current[imageParam.name] as string[]) : [];
          return { ...current, [imageParam.name]: push(prev) };
        }
        return { ...current, [imageParam.name]: url };
      });
    }
    if (!imageParam) setModal("model");
  }

  const hasMore = activeModel?.params.some((param) => !isChipParam(param)) ?? false;

  function pickType(id: GenType) {
    setPopover(null);
    setGenType(id);
    setModelId((current) => {
      const still = models.some((model) => model.id === current && model.type === id);
      if (!still) setParamDraft({});
      return still ? current : "";
    });
  }

  const visibleTechniques = techniques.filter((technique) => {
    const q = techQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      technique.name.toLowerCase().includes(q) ||
      technique.slug.toLowerCase().includes(q) ||
      technique.description.toLowerCase().includes(q)
    );
  });

  const activeWorkspaceName = workspaces.find((w) => w.id === workspaceId)?.name;
  const activeProjectName = projects.find((p) => p.id === projectId)?.name;
  const isConnected = Boolean(savedKey || youmindKey);
  const activeTypeMeta = TYPES.find((t) => t.id === genType) ?? TYPES[0];

  // Shared sidebar history content (rendered in desktop sidebar & mobile history modal)
  function renderHistoryContent() {
    return (
      <div className="space-y-5">
        {/* Current session */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Workspace</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setTab("generate");
              setModal(null);
            }}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
              tab === "generate"
                ? "bg-surface-2 font-medium text-fg"
                : "text-muted hover:bg-surface-2/60 hover:text-fg"
            }`}
          >
            <span className="truncate">
              {threadEntries[0]?.recipe?.prompt || "Current session"}
            </span>
            <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {threadEntries.length}
            </span>
          </button>
        </div>

        {/* Archived sessions */}
        {archivedThreads.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Recent sessions
              </span>
              <button
                type="button"
                onClick={() => void clearHistory()}
                className="text-[11px] text-muted hover:text-danger"
              >
                Clear all
              </button>
            </div>
            <ul className="space-y-1">
              {archivedThreads.map((thread) => (
                <li key={thread.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openThread(thread)}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2/70"
                  >
                    <span className="block truncate text-xs font-medium text-fg-soft group-hover:text-fg">
                      {thread.title}
                    </span>
                    <span className="font-mono text-[10px] text-faint">
                      {thread.entries.length} {thread.entries.length === 1 ? "run" : "runs"} ·{" "}
                      {relativeTime(thread.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteArchived(thread.id)}
                    aria-label={`Delete ${thread.title}`}
                    className="icon-btn size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Saved runs */}
        {history.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Saved runs</span>
              {!archivedThreads.length ? (
                <button
                  type="button"
                  onClick={() => void clearHistory()}
                  className="text-[11px] text-muted hover:text-danger"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <ul className="space-y-1">
              {history.map((item) => (
                <li key={`${item.id}-${item.at}`} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      openThread({
                        id: item.id,
                        title: item.title,
                        updatedAt: item.at,
                        entries: [{ id: item.id, recipe: item.recipe ?? null, snap: item.snap }],
                      })
                    }
                    className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-2/70"
                  >
                    <span className="block truncate text-xs font-medium text-fg-soft group-hover:text-fg">
                      {item.title}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-faint">
                      <span>{item.typeLabel}</span>
                      <span>·</span>
                      <span>{statusLabel(item.status)}</span>
                      {item.cost != null ? (
                        <span className="ml-auto text-fg-soft">{formatUsd(item.cost)}</span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSaved(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="icon-btn size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {archivedThreads.length === 0 && history.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-relaxed text-faint">
            Starting a new session archives your current canvas here for quick recall.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full bg-bg text-fg">
      {/* Desktop Collapsible Sidebar */}
      {sidebarOpen ? (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-canvas lg:sticky lg:top-0 lg:flex lg:h-dvh">
          <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-3.5">
            <div className="flex items-center gap-2.5">
              <StudioMark />
              <span className="text-sm font-semibold tracking-tight text-fg">Studio</span>
            </div>
            <button
              type="button"
              onClick={startNewThread}
              className="btn btn-secondary h-8 px-2.5 text-xs"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              New
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">{renderHistoryContent()}</div>

          <div className="border-t border-border p-2.5">
            <button
              type="button"
              onClick={() => setModal("setup")}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-xs transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    isConnected ? "bg-success" : "bg-warn animate-[dot-pulse_2s_ease-in-out_infinite]"
                  }`}
                />
                <span className="truncate font-medium text-fg-soft">
                  {activeProjectName || activeWorkspaceName || (isConnected ? "Connected" : "Connect API key")}
                </span>
              </span>
              <Settings className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
            </button>
          </div>
        </aside>
      ) : null}

      {/* Main Studio Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-bg/85 px-3 backdrop-blur-md pt-[env(safe-area-inset-top)] sm:px-5">
          {/* Left: Sidebar toggle + Brand + Workspace chip */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="icon-btn hidden size-8 lg:inline-flex"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <PanelLeft className="size-4" />
            </button>

            <div className={`flex items-center gap-2 ${sidebarOpen ? "lg:hidden" : ""}`}>
              <StudioMark />
              <span className="hidden text-sm font-semibold tracking-tight text-fg sm:inline">Studio</span>
            </div>

            {activeProjectName || activeWorkspaceName ? (
              <button
                type="button"
                onClick={() => setModal("setup")}
                className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-fg sm:inline-flex"
                title="Change workspace or project"
              >
                <FolderKanban className="size-3.5 text-primary" aria-hidden="true" />
                <span className="max-w-36 truncate">{activeProjectName || activeWorkspaceName}</span>
              </button>
            ) : null}
          </div>

          {/* Center: Mode switcher (Create | Workflows) */}
          <div
            className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5"
            role="tablist"
            aria-label="Studio modes"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "generate"}
              onClick={() => setTab("generate")}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
                tab === "generate" ? "bg-surface-2 text-fg shadow-2xs" : "text-muted hover:text-fg"
              }`}
            >
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              Create
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "techniques"}
              onClick={() => {
                setTab("techniques");
                if (savedKey && techniques.length === 0 && !techLoading) {
                  void loadTechniqueList();
                }
              }}
              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
                tab === "techniques" ? "bg-surface-2 text-fg shadow-2xs" : "text-muted hover:text-fg"
              }`}
            >
              <Workflow className="size-3" aria-hidden="true" />
              Workflows
            </button>
          </div>

          {/* Right: Balance, New session, History (mobile), Settings */}
          <div className="flex shrink-0 items-center gap-1.5">
            {balanceState === "ready" && balance ? (
              <span
                className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 font-mono text-xs text-fg-soft sm:inline-flex"
                title="Workspace balance"
              >
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                {balance.currency === "USD"
                  ? formatUsd(balance.amount)
                  : `${balance.amount} ${balance.currency}`}
              </span>
            ) : balanceState === "loading" ? (
              <span className="hidden size-8 items-center justify-center text-muted sm:inline-flex">
                <Loader2 className="size-3.5 animate-spin" />
              </span>
            ) : null}

            <button
              type="button"
              onClick={startNewThread}
              aria-label="New session"
              className={`btn btn-secondary h-8 px-2.5 text-xs ${sidebarOpen ? "lg:hidden" : ""}`}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">New</span>
            </button>

            <button
              type="button"
              onClick={() => setModal("history")}
              className="icon-btn size-8 lg:hidden"
              aria-label="Session history"
            >
              <History className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setModal("setup")}
              className="icon-btn relative size-8"
              aria-label="Settings and API keys"
            >
              <Settings className="size-4" />
              {!isConnected ? (
                <span
                  className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-warn"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          </div>
        </header>

        {/* Main Workspace Stage */}
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 py-4 sm:px-6">
          {tab === "generate" ? (
            <div className="flex flex-1 flex-col gap-4">
              {modelsNotice ? (
                <NoticeBlock notice={modelsNotice} onDismiss={() => setModelsNotice(null)} />
              ) : null}

              {/* Advanced Model Settings Drawer */}
              {moreOpen && activeModel ? (
                <div className="card p-4 animate-rise">
                  <ModelSettings
                    model={activeModel}
                    draft={paramDraft}
                    busyParam={busyParam}
                    disabled={!savedKey || !workspaceId}
                    skip={isChipParam}
                    onReset={() => setParamDraft(draftFromDefaults(activeModel))}
                    onChange={writeParam}
                    onAddUrl={(param, url) => {
                      if (!url.startsWith("https://")) {
                        setActionNotice({ message: "Media links must start with https://.", cors: false });
                        return;
                      }
                      setActionNotice(null);
                      setParamDraft((current) => {
                        if (param.type === "string[]") {
                          const prev = Array.isArray(current[param.name])
                            ? (current[param.name] as string[])
                            : [];
                          const max = param.max ?? 14;
                          if (prev.includes(url) || prev.length >= max) return current;
                          return { ...current, [param.name]: [...prev, url] };
                        }
                        return { ...current, [param.name]: url };
                      });
                    }}
                    onRemoveUrl={(param, url) =>
                      setParamDraft((current) => {
                        if (param.type === "string[]") {
                          const prev = Array.isArray(current[param.name])
                            ? (current[param.name] as string[])
                            : [];
                          return { ...current, [param.name]: prev.filter((item) => item !== url) };
                        }
                        const next = { ...current };
                        delete next[param.name];
                        return next;
                      })
                    }
                    onFiles={(param, files) => {
                      if (!files?.length) return;
                      const key = savedKey;
                      if (!key || !workspaceId) {
                        setActionNotice({
                          message: "Choose a workspace before uploading files.",
                          cors: false,
                        });
                        return;
                      }
                      const max = param.type === "string[]" ? (param.max ?? 14) : 1;
                      const existing =
                        param.type === "string[]" && Array.isArray(paramDraft[param.name])
                          ? (paramDraft[param.name] as string[]).length
                          : paramDraft[param.name]
                            ? 1
                            : 0;
                      const room = Math.max(0, max - existing);
                      const uploadBatch = Array.from(files).slice(0, room);
                      if (!uploadBatch.length) return;
                      setBusyParam(param.name);
                      setActionNotice(null);
                      void (async () => {
                        try {
                          const urls: string[] = [];
                          for (const file of uploadBatch) {
                            urls.push(await uploadAsset(key, workspaceId, projectId, file));
                          }
                          if (!alive.current) return;
                          setParamDraft((current) => {
                            if (param.type === "string[]") {
                              const prev = Array.isArray(current[param.name])
                                ? (current[param.name] as string[])
                                : [];
                              return { ...current, [param.name]: [...prev, ...urls].slice(0, max) };
                            }
                            return { ...current, [param.name]: urls[0] };
                          });
                        } catch (error) {
                          if (alive.current) setActionNotice(formatFloraError(error));
                        } finally {
                          if (alive.current) setBusyParam(null);
                        }
                      })();
                    }}
                  />
                </div>
              ) : null}

              {/* Feed or Empty State */}
              {threadEntries.length > 0 ? (
                <div className="space-y-4 pb-2">
                  {threadEntries.map((entry) => (
                    <RunPanel
                      key={entry.id}
                      run={entry.snap}
                      recipe={entry.recipe}
                      running={busyIds.includes(entry.id)}
                      notice={activeEntryId === entry.id ? actionNotice : null}
                      alt={entry.recipe?.prompt || prompt}
                      onStop={() => stopEntry(entry.id)}
                      onRerun={() => {
                        if (entry.recipe) void rerun(entry.recipe);
                      }}
                      onDelete={(index) => deletePiece(entry.id, index)}
                      onUseSeed={(seed) => applySeed(seed, entry.recipe)}
                      onUseImage={useAsReference}
                      onSelectPrompt={(text) => {
                        setPrompt(text);
                        promptRef.current?.focus();
                      }}
                      startedAt={entry.startedAt}
                    />
                  ))}
                </div>
              ) : (
                <div className="my-auto flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                  {actionNotice ? (
                    <div className="mb-5 w-full max-w-md text-left">
                      <NoticeBlock notice={actionNotice} onDismiss={() => setActionNotice(null)} />
                    </div>
                  ) : null}

                  <div className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl border border-border-strong bg-surface text-primary shadow-lift">
                    <activeTypeMeta.icon className="size-5" aria-hidden="true" />
                  </div>

                  <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
                    What would you like to create?
                  </h1>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted sm:text-sm">
                    Generate studio-grade images, video, audio, text, and 3D assets from a prompt, or pick a starting direction below.
                  </p>

                  {!isConnected ? (
                    <button
                      type="button"
                      onClick={() => setModal("setup")}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-primary/60 hover:bg-primary/15"
                    >
                      <KeyRound className="size-3.5 text-primary" aria-hidden="true" />
                      Connect your Flora or YouMind API key to start generating →
                    </button>
                  ) : null}

                  {/* Curated Starter Prompts */}
                  <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
                    {STARTER_PROMPTS[genType].map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        onClick={() => {
                          setPrompt(starter.prompt);
                          promptRef.current?.focus();
                        }}
                        className="group rounded-xl border border-border bg-surface/70 p-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                      >
                        <p className="text-xs font-medium text-fg group-hover:text-primary">
                          {starter.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                          {starter.prompt}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <WorkflowsView
              techniques={techniques}
              visibleTechniques={visibleTechniques}
              techLoading={techLoading}
              techNotice={techNotice}
              techQuery={techQuery}
              onQueryChange={setTechQuery}
              slugDraft={slugDraft}
              onSlugChange={setSlugDraft}
              activeTechnique={activeTechnique}
              techInputs={techInputs}
              inputValues={inputValues}
              onInputValueChange={(id, value) =>
                setInputValues((current) => ({ ...current, [id]: value }))
              }
              techDetailLoading={techDetailLoading}
              running={running}
              hasKey={Boolean(savedKey)}
              onLoadList={() => void loadTechniqueList()}
              onSelectTechnique={(slug) => void selectTechnique(slug)}
              onRunTechnique={() => void runTechnique()}
              onOpenSettings={() => setModal("setup")}
            />
          )}
        </main>

        {/* Sticky Bottom Composer (Generate mode) */}
        {tab === "generate" ? (
          <div className="sticky bottom-0 z-20 mx-auto w-full max-w-4xl bg-gradient-to-t from-bg via-bg/95 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-4">
            <div className="rounded-2xl border border-border-strong bg-surface/95 p-3 shadow-float backdrop-blur-md">
              {/* Row 1: Media Type Selector + Model Selector */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {TYPES.map((type) => {
                    const Icon = type.icon;
                    const on = genType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        aria-label={type.label}
                        aria-pressed={on}
                        onClick={() => pickType(type.id)}
                        className={`inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${
                          on
                            ? "bg-fg px-2.5 text-bg"
                            : "w-7 text-muted hover:bg-white/[0.06] hover:text-fg sm:w-auto sm:px-2.5"
                        }`}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                        <span className={on ? "inline" : "hidden sm:inline"}>{type.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setModal("model")}
                  className="chip h-7 max-w-[48%] shrink px-2.5 text-xs"
                  title="Select model"
                >
                  {activeModel ? (
                    <CompanyLogo name={activeModel.company} compact />
                  ) : (
                    <Sparkles className="size-3 text-primary" aria-hidden="true" />
                  )}
                  <span className="truncate font-medium">
                    {activeModel?.name ?? (loadingModels ? "Loading models…" : "Choose model")}
                  </span>
                  <ChevronDown className="size-3 shrink-0 text-muted" aria-hidden="true" />
                </button>
              </div>

              {/* Attached Reference Images Strip */}
              {refUrls.length > 0 ? (
                <div className="mb-2 flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                  {refUrls.map((url) => (
                    <div
                      key={url}
                      className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2"
                    >
                      <img src={url} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeRefUrl(url)}
                        className="absolute right-0.5 top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-black/80 text-white"
                        aria-label="Remove reference"
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                  {refUrls.length < refMax ? (
                    <button
                      type="button"
                      onClick={() => setModal("refs")}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted hover:border-white/25 hover:text-fg"
                      aria-label="Add another reference"
                    >
                      <Plus className="size-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Prompt Textarea */}
              <div className="relative">
                <textarea
                  id="prompt"
                  ref={promptRef}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void generate();
                    }
                  }}
                  rows={2}
                  placeholder={activeTypeMeta.placeholder}
                  className="w-full resize-none overflow-y-auto bg-transparent px-1 py-1 pr-8 text-[15px] leading-relaxed text-fg outline-none placeholder:text-faint"
                />
                {prompt.trim() ? (
                  <button
                    type="button"
                    onClick={() => setPrompt("")}
                    aria-label="Clear prompt"
                    className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-md text-faint hover:bg-white/[0.06] hover:text-fg"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              {/* Hidden Camera Input */}
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file || !refParam) return;
                  const key = savedKey;
                  if (!key || !workspaceId) {
                    setActionNotice({
                      message: "Choose a workspace before uploading files.",
                      cors: false,
                    });
                    return;
                  }
                  const max = refParam.type === "string[]" ? (refParam.max ?? 14) : 1;
                  setBusyParam(refParam.name);
                  void (async () => {
                    try {
                      const url = await uploadAsset(key, workspaceId, projectId, file);
                      if (!alive.current) return;
                      if (merged) {
                        setHeldImages((current) =>
                          current.includes(url) || current.length >= refMax
                            ? current
                            : [...current, url].slice(0, refMax),
                        );
                        return;
                      }
                      setParamDraft((current) => {
                        if (refParam.type === "string[]") {
                          const prev = Array.isArray(current[refParam.name])
                            ? (current[refParam.name] as string[])
                            : [];
                          if (prev.includes(url) || prev.length >= max) return current;
                          return { ...current, [refParam.name]: [...prev, url].slice(0, max) };
                        }
                        return { ...current, [refParam.name]: url };
                      });
                    } catch (error) {
                      if (alive.current) setActionNotice(formatFloraError(error));
                    } finally {
                      if (alive.current) setBusyParam(null);
                    }
                  })();
                }}
              />

              {/* Row 3: Parameter Chips + Generate Action */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {refParam ? (
                    <button
                      type="button"
                      onClick={() => setModal("refs")}
                      className="chip h-8 px-2.5 text-xs"
                    >
                      <ImageIcon className="size-3.5" aria-hidden="true" />
                      <span>
                        {refMax <= 1
                          ? refUrls.length
                            ? "1 ref"
                            : "Reference"
                          : `Refs ${refUrls.length}/${refMax}`}
                      </span>
                    </button>
                  ) : null}

                  {refParam ? (
                    <button
                      type="button"
                      aria-label="Camera upload"
                      onClick={() => cameraRef.current?.click()}
                      className="chip size-8 justify-center p-0 sm:hidden"
                    >
                      <Camera className="size-3.5" />
                    </button>
                  ) : null}

                  {/* Aspect Ratio Inline Popover */}
                  {aspectParam ? (
                    <div className="relative">
                      <button
                        type="button"
                        aria-pressed={popover === "aspect"}
                        onClick={() => setPopover((p) => (p === "aspect" ? null : "aspect"))}
                        className="chip h-8 px-2.5 text-xs"
                      >
                        <RatioMark
                          value={aspectValue}
                          label={
                            aspectParam.options.find((option) => option.value === aspectValue)?.label ??
                            aspectValue
                          }
                        />
                        <span>
                          {shortSetting(
                            aspectValue,
                            aspectParam.options.find((option) => option.value === aspectValue)?.label ??
                              aspectValue,
                          )}
                        </span>
                      </button>
                      <Popover
                        open={popover === "aspect"}
                        onClose={() => setPopover(null)}
                        width="w-64"
                      >
                        <AspectPicker
                          param={aspectParam}
                          value={aspectValue}
                          disabled={!savedKey}
                          onChange={(next) => {
                            writeParam(aspectParam.name, next);
                            setPopover(null);
                          }}
                        />
                      </Popover>
                    </div>
                  ) : null}

                  {/* Resolution Cycle Chip */}
                  {resolutionParam ? (
                    <button
                      type="button"
                      onClick={() => {
                        const values = resolutionParam.options.map((option) => option.value);
                        if (!values.length) return;
                        const index = values.indexOf(resolutionValue);
                        writeParam(resolutionParam.name, values[(index + 1) % values.length]);
                      }}
                      className="chip h-8 px-2.5 font-mono text-xs"
                      title="Resolution"
                    >
                      {shortSetting(
                        resolutionValue,
                        resolutionParam.options.find((option) => option.value === resolutionValue)
                          ?.label ?? "",
                      )}
                    </button>
                  ) : null}

                  {/* Duration Chip / Popover */}
                  {durationParam ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (durationParam.options.length > 4) {
                            setPopover((p) => (p === "duration" ? null : "duration"));
                            return;
                          }
                          const values = durationParam.options.map((option) => option.value);
                          const index = values.indexOf(durationValue);
                          writeParam(durationParam.name, values[(index + 1) % values.length]);
                        }}
                        className="chip h-8 px-2.5 font-mono text-xs"
                        title="Duration"
                      >
                        {durationLabel(
                          durationValue,
                          durationParam.options.find((option) => option.value === durationValue)
                            ?.label ?? "",
                        )}
                      </button>
                      <Popover
                        open={popover === "duration"}
                        onClose={() => setPopover(null)}
                        width="w-56"
                      >
                        <p className="mb-2 text-xs font-medium text-fg-soft">Duration</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {durationParam.options.map((option) => {
                            const on = option.value === durationValue;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  writeParam(durationParam.name, option.value);
                                  setPopover(null);
                                }}
                                className={`h-8 rounded-lg border font-mono text-xs ${
                                  on
                                    ? "border-primary/60 bg-primary/15 text-fg"
                                    : "border-border text-muted hover:text-fg"
                                }`}
                              >
                                {durationLabel(option.value, option.label)}
                              </button>
                            );
                          })}
                        </div>
                      </Popover>
                    </div>
                  ) : null}

                  {/* Quality / Thinking Chips */}
                  {qualityParams.map((param) => {
                    const raw = paramDraft[param.name];
                    const current =
                      typeof raw === "string" && raw
                        ? raw
                        : param.defaultValue == null
                          ? (param.options[0]?.value ?? "")
                          : String(param.defaultValue);
                    const thinking =
                      param.type === "bool" || /think|reason/i.test(`${param.name} ${param.label}`);
                    const enabled =
                      param.type === "bool"
                        ? raw === true || (raw == null && param.defaultValue === true)
                        : false;
                    const option = param.options.find((item) => item.value === current);
                    const label =
                      param.type === "bool"
                        ? thinking
                          ? "Think"
                          : param.label
                        : shortSetting(current, option?.label ?? current);
                    return (
                      <button
                        key={param.name}
                        type="button"
                        aria-pressed={param.type === "bool" ? enabled : undefined}
                        onClick={() => {
                          if (param.type === "bool") {
                            writeParam(param.name, !enabled);
                            return;
                          }
                          const values = param.options.map((item) => item.value);
                          if (!values.length) return;
                          const index = values.indexOf(current);
                          writeParam(param.name, values[(index + 1) % values.length]);
                        }}
                        className="chip h-8 px-2.5 text-xs"
                      >
                        {label}
                      </button>
                    );
                  })}

                  {/* Batch Size Inline Popover (Image) */}
                  {genType === "image" ? (
                    <div className="relative">
                      <button
                        type="button"
                        aria-pressed={popover === "batch"}
                        onClick={() => setPopover((p) => (p === "batch" ? null : "batch"))}
                        className="chip h-8 px-2.5 font-mono text-xs"
                        title="Batch count"
                      >
                        <Layers className="size-3.5" aria-hidden="true" />
                        <span>{batch}×</span>
                      </button>
                      <Popover
                        open={popover === "batch"}
                        onClose={() => setPopover(null)}
                        width="w-52"
                      >
                        <p className="mb-2 text-xs font-medium text-fg-soft">Parallel outputs</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[1, 2, 3, 4].map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => {
                                setBatch(count);
                                setPopover(null);
                              }}
                              className={`h-8 rounded-lg border font-mono text-xs ${
                                batch === count
                                  ? "border-primary/60 bg-primary/15 text-fg"
                                  : "border-border text-muted hover:text-fg"
                              }`}
                            >
                              {count}×
                            </button>
                          ))}
                        </div>
                      </Popover>
                    </div>
                  ) : null}

                  {/* Model Variations Count Popover */}
                  {countParam ? (
                    <div className="relative">
                      <button
                        type="button"
                        aria-pressed={popover === "count"}
                        onClick={() => setPopover((p) => (p === "count" ? null : "count"))}
                        className="chip h-8 px-2.5 font-mono text-xs"
                      >
                        <Layers className="size-3.5" aria-hidden="true" />
                        <span>{countValue}</span>
                      </button>
                      <Popover
                        open={popover === "count"}
                        onClose={() => setPopover(null)}
                        width="w-48"
                      >
                        <p className="mb-2 text-xs font-medium text-fg-soft">Variations</p>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={countIndex <= 0}
                            onClick={() => writeParam(countParam.name, countList[countIndex - 1])}
                            className="btn btn-secondary size-8 p-0"
                            aria-label="Fewer variations"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="font-mono text-sm font-semibold">{countValue}</span>
                          <button
                            type="button"
                            disabled={countIndex >= countList.length - 1}
                            onClick={() => writeParam(countParam.name, countList[countIndex + 1])}
                            className="btn btn-secondary size-8 p-0"
                            aria-label="More variations"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </Popover>
                    </div>
                  ) : null}

                  {/* Advanced Parameters Toggle */}
                  {hasMore ? (
                    <button
                      type="button"
                      aria-pressed={moreOpen}
                      onClick={() => {
                        setMoreOpen((value) => {
                          if (!value) window.scrollTo({ top: 0, behavior: "smooth" });
                          return !value;
                        });
                      }}
                      className="chip h-8 px-2.5 text-xs"
                    >
                      <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                      <span>Parameters</span>
                    </button>
                  ) : null}
                </div>

                {/* Right: Voice + Generate */}
                <div className="ml-auto flex items-center gap-1.5">
                  {canDictate ? (
                    <button
                      type="button"
                      aria-label="Dictate prompt"
                      onClick={() => {
                        startDictation((text) => {
                          setPrompt((current) => (current.trim() ? `${current.trim()} ${text}` : text));
                        });
                      }}
                      className="icon-btn size-8"
                      title="Voice input"
                    >
                      <Mic className="size-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void generate()}
                    aria-label={quote != null ? `Generate, about ${formatUsd(quote)}` : "Generate"}
                    className="btn btn-primary h-9 rounded-xl px-3.5 text-xs font-semibold"
                  >
                    {quoting ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    )}
                    <span>Generate</span>
                    {quote != null ? (
                      <span className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums">
                        {formatUsd(quote * (genType === "image" ? batch : 1))}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Spend Confirmation Dialog */}
      {spendAsk ? (
        <Dialog
          title="Confirm generation cost"
          subtitle="This run exceeds the $0.50 confirmation threshold."
          maxWidth="max-w-sm"
          onClose={() => setSpendAsk(null)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {spendAsk.copies > 1
                ? `Generating ${spendAsk.copies} images will cost approximately `
                : "This generation will cost approximately "}
              <span className="font-mono font-semibold text-fg">{formatUsd(spendAsk.cost)}</span>. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSpendAsk(null)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = spendAsk.recipe;
                  const copies = spendAsk.copies;
                  setSpendAsk(null);
                  if (copies > 1) {
                    void runMany(Array.from({ length: copies }, (_, index) => recipeVariant(next, index)));
                  } else {
                    void runGeneration(next);
                  }
                }}
                className="btn btn-primary flex-1"
              >
                Generate
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {/* Model Picker Modal */}
      {modal === "model" ? (
        <Dialog
          title="Choose model"
          subtitle="Select a model for this generation or pin favourites to the top."
          maxWidth="max-w-lg"
          onClose={() => setModal(null)}
        >
          {heldImages.length && !refParam ? (
            <p className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-fg">
              Pick a model that accepts image inputs to attach your selected reference image.
            </p>
          ) : null}
          <ModelPicker
            models={models}
            modelId={modelId}
            modelType={genType}
            disabled={(!savedKey && !youmindKey) || loadingModels}
            loading={loadingModels}
            imageCount={merged ? heldImages.length : 0}
            pinnedIds={pins}
            onTogglePin={togglePin}
            onSelect={(model) => {
              if (!model) {
                setModelId("");
                setParamDraft({});
                setHeldImages([]);
                setModal(null);
                return;
              }
              if (isGenType(model.type)) {
                setGenType(model.type);
              }
              const peers = sameNameVariants(models, model);
              const slots =
                peers.length > 1
                  ? Math.max(peers.length - 1, ...peers.map(imageSlots))
                  : imageSlots(model);
              const images = slots > 0 ? heldImages.slice(0, slots) : [];
              const chosen =
                peers.length > 1 ? (variantForImageCount(peers, images.length) ?? model) : model;
              setModelId(chosen.id);
              setParamDraft(
                slots > 0 ? applyHeldImages(chosen, images, paramDraft) : draftFromDefaults(chosen),
              );
              setModal(null);
            }}
          />
        </Dialog>
      ) : null}

      {/* Reference Images Modal */}
      {modal === "refs" && refParam ? (
        <Dialog
          title="Reference media"
          subtitle="Upload files or paste an https:// image link to guide the model."
          maxWidth="max-w-md"
          onClose={() => setModal(null)}
        >
          <MediaControl
            param={refParam}
            urls={refUrls}
            busy={busyParam === refParam.name}
            disabled={!savedKey || !workspaceId}
            onAddUrl={(url) => {
              if (!url.startsWith("https://")) {
                setActionNotice({ message: "Image links must start with https://.", cors: false });
                return;
              }
              setActionNotice(null);
              if (merged) {
                setHeldImages((current) =>
                  current.includes(url) || current.length >= refMax ? current : [...current, url],
                );
                return;
              }
              setParamDraft((current) => {
                if (refParam.type === "string[]") {
                  const prev = Array.isArray(current[refParam.name])
                    ? (current[refParam.name] as string[])
                    : [];
                  const max = refParam.max ?? 14;
                  if (prev.includes(url) || prev.length >= max) return current;
                  return { ...current, [refParam.name]: [...prev, url] };
                }
                return { ...current, [refParam.name]: url };
              });
            }}
            onRemove={removeRefUrl}
            onFiles={(files) => {
              if (!files?.length) return;
              const key = savedKey;
              if (!key || !workspaceId) {
                setActionNotice({
                  message: "Choose a workspace before uploading files.",
                  cors: false,
                });
                return;
              }
              const max = merged ? refMax : refParam.type === "string[]" ? (refParam.max ?? 14) : 1;
              const existing = merged
                ? heldImages.length
                : refParam.type === "string[]" && Array.isArray(paramDraft[refParam.name])
                  ? (paramDraft[refParam.name] as string[]).length
                  : paramDraft[refParam.name]
                    ? 1
                    : 0;
              const room = Math.max(0, max - existing);
              const uploadBatch = Array.from(files).slice(0, room);
              if (!uploadBatch.length) return;
              setBusyParam(refParam.name);
              setActionNotice(null);
              void (async () => {
                try {
                  const urls: string[] = [];
                  for (const file of uploadBatch) {
                    urls.push(await uploadAsset(key, workspaceId, projectId, file));
                  }
                  if (!alive.current) return;
                  if (merged) {
                    setHeldImages((current) => {
                      const next = [...current];
                      for (const url of urls) {
                        if (!next.includes(url) && next.length < refMax) next.push(url);
                      }
                      return next;
                    });
                    return;
                  }
                  setParamDraft((current) => {
                    if (refParam.type === "string[]") {
                      const prev = Array.isArray(current[refParam.name])
                        ? (current[refParam.name] as string[])
                        : [];
                      return { ...current, [refParam.name]: [...prev, ...urls].slice(0, max) };
                    }
                    return { ...current, [refParam.name]: urls[0] };
                  });
                } catch (error) {
                  if (alive.current) setActionNotice(formatFloraError(error));
                } finally {
                  if (alive.current) setBusyParam(null);
                }
              })();
            }}
          />
        </Dialog>
      ) : null}

      {/* Settings Modal */}
      {modal === "setup" ? (
        <SettingsModal
          user={user}
          apiKeyInput={apiKeyInput}
          onApiKeyChange={setApiKeyInput}
          savedKey={savedKey}
          showKey={showKey}
          onToggleShowKey={() => setShowKey((v) => !v)}
          dirty={dirty}
          loadingWs={loadingWs}
          onSaveAndConnect={() => void saveAndConnect()}
          onClearKey={clearKey}
          connNotice={connNotice}
          workspaces={workspaces}
          workspaceId={workspaceId}
          onWorkspaceChange={(id) => void onWorkspace(id)}
          projects={projects}
          projectId={projectId}
          loadingProjects={loadingProjects}
          onProjectChange={onProject}
          balance={balance}
          balanceState={balanceState}
          youmindInput={youmindInput}
          onYoumindChange={setYoumindInput}
          youmindKey={youmindKey}
          showYoumind={showYoumind}
          onToggleShowYoumind={() => setShowYoumind((v) => !v)}
          youmindBusy={youmindBusy}
          onSaveYoumind={() => void saveYoumind()}
          onClearYoumind={clearYoumind}
          onClose={() => setModal(null)}
        />
      ) : null}

      {/* Mobile History Modal */}
      {modal === "history" ? (
        <Dialog
          title="Sessions & History"
          subtitle="Switch between recent sessions and saved generations."
          maxWidth="max-w-md"
          onClose={() => setModal(null)}
        >
          {!user ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-muted">Sign in to sync your runs across devices.</p>
              <div className="flex gap-1.5">
                {GROK_PROVIDERS.map((provider) => (
                  <button
                    key={provider.providerId}
                    type="button"
                    onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                    className="btn btn-secondary h-7 px-2.5 text-xs"
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {renderHistoryContent()}
        </Dialog>
      ) : null}
    </div>
  );
}
