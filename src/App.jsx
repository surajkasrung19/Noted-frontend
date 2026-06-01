import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleAlert,
  CalendarClock,
  FileText,
  ListChecks,
  Maximize2,
  Minimize2,
  LogOut,
  Mic,
  Moon,
  PanelLeft,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Copy,
  Sun,
  Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Editor from "./components/Editor.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import FolderTree from "./components/FolderTree.jsx";
import NoteList from "./components/NoteList.jsx";
import {
  createFolder,
  createNote,
  createReminder,
  deleteNoteForever,
  getFolders,
  getHealth,
  getMe,
  getNote,
  getNotes,
  getReminders,
  getTags,
  getVersions,
  markReminderSent,
  patchNote,
  restoreNote,
  restoreVersion,
  setAuthToken,
  trashNote,
  updateNote
} from "./api/client.js";
import { useDebounce } from "./hooks/useDebounce.js";
import { useTheme } from "./hooks/useTheme.js";
import { htmlToText } from "./utils/text.js";

const emptyDraft = {
  title: "Untitled note",
  content: "",
  markdown: "",
  color: "#ffffff",
  tags: [],
  folder: null,
  checklist: [],
  reminderAt: "",
  reminderEmail: ""
};

function normalizeChecklist(checklist = []) {
  if (!Array.isArray(checklist)) return [];

  return checklist.map((item) => ({
    ...item,
    text: String(item?.text ?? ""),
    checked: Boolean(item?.checked)
  }));
}

function storedAuthUser() {
  try {
    const storedUser = localStorage.getItem("noted-user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem("noted-user");
    return null;
  }
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("noted-token");
    const user = storedAuthUser();
    if (token) setAuthToken(token);
    return { token, user, checking: Boolean(token) };
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState("saved");
  const [notice, setNotice] = useState("");
  const [apiReady, setApiReady] = useState(false);
  const [filters, setFilters] = useState({ q: "", status: "active", folder: "", tag: "" });
  const [folderDialog, setFolderDialog] = useState({ open: false, parent: null, name: "", busy: false });
  const [focusMode, setFocusMode] = useState(false);
  const saveSequenceRef = useRef(0);
  const debouncedQuery = useDebounce(filters.q, 350);

  const selectedNote = useMemo(
    () => notes.find((note) => note._id === selectedId),
    [notes, selectedId]
  );

  const clearWorkspace = useCallback(() => {
    setNotes([]);
    setFolders([]);
    setTags([]);
    setVersions([]);
    setSelectedId("");
    setDraft(emptyDraft);
    setDirty(false);
    setSaving("saved");
    setNotice("");
    setApiReady(false);
  }, []);

  const handleAuthed = useCallback((result) => {
    localStorage.setItem("noted-token", result.token);
    localStorage.setItem("noted-user", JSON.stringify(result.user));
    setAuth({ token: result.token, user: result.user, checking: false });
    setAuthToken(result.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("noted-token");
    localStorage.removeItem("noted-user");
    setAuthToken("");
    setAuth({ token: "", user: null, checking: false });
    clearWorkspace();
  }, [clearWorkspace]);

  const showError = useCallback((error, fallback = "Something went wrong") => {
    setNotice(error?.response?.data?.message || error?.message || fallback);
  }, []);

  const checkApi = useCallback(async () => {
    try {
      await getHealth();
      setApiReady(true);
      setNotice("");
      return true;
    } catch (error) {
      setApiReady(false);
      showError(error, "Could not connect to the Noted API");
      return false;
    }
  }, [showError]);

  const loadFolders = useCallback(async () => {
    try {
      setFolders(await getFolders(true));
    } catch (error) {
      showError(error, "Could not load folders");
    }
  }, [showError]);

  const loadTags = useCallback(async () => {
    try {
      setTags(await getTags());
    } catch (error) {
      showError(error, "Could not load tags");
    }
  }, [showError]);

  const loadNotes = useCallback(async () => {
    try {
      const nextNotes = await getNotes({
        q: debouncedQuery || undefined,
        status: filters.status,
        folder: filters.folder || undefined,
        tag: filters.tag || undefined
      });

      setNotes(nextNotes);
      if (!selectedId && nextNotes[0]) setSelectedId(nextNotes[0]._id);
      if (selectedId && !nextNotes.some((note) => note._id === selectedId)) {
        setSelectedId(nextNotes[0]?._id || "");
      }
    } catch (error) {
      showError(error, "Could not load notes. Check that the backend and MongoDB are running.");
    }
  }, [debouncedQuery, filters.folder, filters.status, filters.tag, selectedId, showError]);

  useEffect(() => {
    if (!auth.token) return;
    checkApi();
  }, [auth.token, checkApi]);

  useEffect(() => {
    if (!auth.token || !auth.checking) return;

    let cancelled = false;

    async function restoreSession() {
      try {
        const user = await getMe();
        if (cancelled) return;
        localStorage.setItem("noted-user", JSON.stringify(user));
        setAuth((current) => ({ ...current, user, checking: false }));
      } catch {
        if (!cancelled) logout();
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [auth.checking, auth.token, logout]);

  useEffect(() => {
    if (!apiReady) return;
    loadFolders();
    loadTags();
  }, [apiReady, loadFolders, loadTags]);

  useEffect(() => {
    if (!apiReady) return;
    loadNotes();
  }, [apiReady, loadNotes]);

  useEffect(() => {
    if (!selectedId) {
      setDraft(emptyDraft);
      setVersions([]);
      return;
    }

    let cancelled = false;

    async function loadSelected() {
      try {
        const note = await getNote(selectedId);
        const history = await getVersions(selectedId);
        if (cancelled) return;
        setDraft({
          ...emptyDraft,
          ...note,
          folder: note.folder?._id || note.folder || null,
          checklist: normalizeChecklist(note.checklist),
          reminderAt: note.reminderAt ? note.reminderAt.slice(0, 16) : ""
        });
        setVersions(history);
        setDirty(false);
        setSaving("saved");
      } catch (error) {
        showError(error, "Could not open this note");
      }
    }

    loadSelected();
    return () => {
      cancelled = true;
    };
  }, [selectedId, showError]);

  useEffect(() => {
    if (!dirty || !selectedId) return undefined;

    const controller = new AbortController();
    const saveId = ++saveSequenceRef.current;
    setSaving("unsaved");
    const timer = window.setTimeout(async () => {
      try {
        setSaving("saving");
        const payload = {
          ...draft,
          plainText: htmlToText(draft.content),
          reminderAt: draft.reminderAt || null,
          saveState: "saved",
          reason: "autosave",
          createVersion: false
        };
        const saved = await updateNote(selectedId, payload, { signal: controller.signal });
        if (controller.signal.aborted || saveId !== saveSequenceRef.current) return;
        setNotes((current) => current.map((note) => (note._id === saved._id ? { ...note, ...saved } : note)));
        setDirty(false);
        setSaving("saved");
        loadTags();
      } catch (error) {
        if (controller.signal.aborted || error.code === "ERR_CANCELED") return;
        setSaving("unsaved");
        showError(error, "Autosave failed");
      }
    }, 900);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dirty, draft, loadTags, selectedId, showError]);

  useEffect(() => {
    if (!apiReady) return undefined;

    const timer = window.setInterval(async () => {
      if (!("Notification" in window)) return;
      try {
        const reminders = await getReminders();
        const due = reminders.filter((item) => !item.sentAt && item.browser && new Date(item.remindAt) <= new Date());

        for (const reminder of due) {
          if (Notification.permission === "default") await Notification.requestPermission();
          if (Notification.permission === "granted") {
            new Notification("Noted reminder", {
              body: reminder.note?.title || "You have a note reminder"
            });
          }
          await markReminderSent(reminder._id);
        }
      } catch {
        // Reminder polling should never block note editing.
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [apiReady]);

  const saveClosedVersion = useCallback(async () => {
    if (!selectedId || !apiReady) return;

    saveSequenceRef.current += 1;
    await updateNote(selectedId, {
      ...draft,
      plainText: htmlToText(draft.content),
      reminderAt: draft.reminderAt || null,
      saveState: "saved",
      reason: "closed",
      createVersion: true
    });
  }, [apiReady, draft, selectedId]);

  const updateDraft = useCallback((patch) => {
    setNotice("");
    setDraft((current) => ({
      ...current,
      ...patch,
      checklist: patch.checklist ? normalizeChecklist(patch.checklist) : current.checklist
    }));
    setDirty(true);
  }, []);

  const selectNote = async (noteId) => {
    if (noteId === selectedId) return;

    try {
      await saveClosedVersion();
    } catch (error) {
      showError(error, "Could not save note version before switching");
    }

    setSelectedId(noteId);
  };

  const handleCreateNote = async (type = "note") => {
    if (!apiReady && !(await checkApi())) return;

    const reminderStart = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const presets = {
      note: {},
      checklist: {
        checklist: [{ text: "First task", checked: false }],
        markdown: "- [ ] First task"
      },
      voice: {
        content: "<p>Voice note ready. Open this note and press Voice note to start recording.</p>",
        plainText: "Voice note ready. Open this note and press Voice note to start recording."
      },
      reminder: {
        reminderAt: reminderStart,
        plainText: "Reminder draft",
        content: "<p>Reminder draft</p>"
      }
    };

    try {
      await saveClosedVersion();
      const note = await createNote({
        ...emptyDraft,
        ...(presets[type] || presets.note),
        title: "Untitled note",
        folder: filters.folder || null,
        saveState: "draft"
      });
      setNotes((current) => [note, ...current]);
      setSelectedId(note._id);
      setNotice("");
    } catch (error) {
      showError(error, "Could not create note. Check that the backend, MongoDB, and CORS settings are running.");
    }
  };

  const openFolderDialog = (parent = null) => {
    setFolderDialog({ open: true, parent, name: "", busy: false });
  };

  const closeFolderDialog = () => {
    setFolderDialog({ open: false, parent: null, name: "", busy: false });
  };

  const handleCreateFolder = async (event) => {
    event.preventDefault();
    if (!apiReady && !(await checkApi())) return;

    const name = folderDialog.name.trim();
    if (!name) return;

    setFolderDialog((current) => ({ ...current, busy: true }));
    try {
      await createFolder({ name, parent: folderDialog.parent });
      await loadFolders();
      closeFolderDialog();
    } catch (error) {
      showError(error, "Could not create folder");
      setFolderDialog((current) => ({ ...current, busy: false }));
    }
  };

  const refreshCurrent = async () => {
    try {
      await loadNotes();
      await loadTags();
      if (selectedId) setVersions(await getVersions(selectedId));
    } catch (error) {
      showError(error, "Could not refresh notes");
    }
  };

  const moveCurrentNote = async (folder) => {
    if (!selectedId) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await patchNote(selectedId, "move", { folder });
      updateDraft({ folder });
      refreshCurrent();
    } catch (error) {
      showError(error, "Could not move note");
    }
  };

  const togglePin = async () => {
    if (!selectedId) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await patchNote(selectedId, "pin", { isPinned: !selectedNote?.isPinned });
      refreshCurrent();
    } catch (error) {
      showError(error, "Could not pin note");
    }
  };

  const toggleArchive = async () => {
    if (!selectedId) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await patchNote(selectedId, "archive", { isArchived: !selectedNote?.isArchived });
      refreshCurrent();
    } catch (error) {
      showError(error, "Could not archive note");
    }
  };

  const moveToTrash = async () => {
    if (!selectedId) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await trashNote(selectedId);
      setSelectedId("");
      refreshCurrent();
    } catch (error) {
      showError(error, "Could not move note to trash");
    }
  };

  const duplicateCurrentNote = async () => {
    if (!selectedId) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await saveClosedVersion();
      const note = await createNote({
        ...emptyDraft,
        ...draft,
        title: `${draft.title || "Untitled note"} copy`,
        folder: draft.folder || null,
        reminderAt: null,
        saveState: "draft"
      });
      setNotes((current) => [note, ...current]);
      setSelectedId(note._id);
      setNotice("Note duplicated");
    } catch (error) {
      showError(error, "Could not duplicate note");
    }
  };

  const shareCurrentNote = async () => {
    if (!selectedId) return;

    const shareText = `${draft.title || "Untitled note"}\n\n${htmlToText(draft.content) || draft.markdown || ""}`.trim();

    try {
      if (navigator.share) {
        await navigator.share({
          title: draft.title || "Untitled note",
          text: shareText
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      setNotice("Note copied for sharing");
    } catch (error) {
      showError(error, "Could not share note");
    }
  };

  const restoreFromTrash = async () => {
    if (!selectedId) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await restoreNote(selectedId);
      refreshCurrent();
    } catch (error) {
      showError(error, "Could not restore note");
    }
  };

  const deleteForever = async () => {
    if (!selectedId || !window.confirm("Delete this note permanently?")) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await deleteNoteForever(selectedId);
      setSelectedId("");
      refreshCurrent();
    } catch (error) {
      showError(error, "Could not delete note permanently");
    }
  };

  const saveReminder = async () => {
    if (!selectedId || !draft.reminderAt) return;
    if (!apiReady && !(await checkApi())) return;

    try {
      await createReminder({
        note: selectedId,
        remindAt: draft.reminderAt,
        email: draft.reminderEmail,
        browser: true
      });
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setNotice("Reminder set");
    } catch (error) {
      showError(error, "Could not set reminder");
    }
  };

  const statusIcon = {
    saved: <CheckCircle2 size={16} />,
    saving: <CircleAlert size={16} />,
    unsaved: <CircleAlert size={16} />
  };

  if (auth.checking) {
    return <div className="boot-screen">Opening your private workspace...</div>;
  }

  if (!auth.token) {
    return <AuthScreen onAuthed={handleAuthed} />;
  }

  return (
    <div className={`${sidebarOpen && !focusMode ? "app-shell" : "app-shell sidebar-collapsed"} ${focusMode ? "focus-mode" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="brand-row">
          <div>
            <h1>Noted</h1>
            <span>Private workspace</span>
          </div>
          <button className="icon-button" onClick={() => setSidebarOpen(false)} title="Close sidebar">
            <PanelLeft size={18} />
          </button>
        </div>

        <section className="create-stack" aria-label="Create">
          <button className="create-action primary" onClick={() => handleCreateNote("note")}>
            <Plus size={18} />
            <span>New Note</span>
          </button>
          <button className="create-action" onClick={() => handleCreateNote("checklist")}>
            <ListChecks size={17} />
            <span>Checklist</span>
          </button>
          <button className="create-action" onClick={() => handleCreateNote("voice")}>
            <Mic size={17} />
            <span>Voice Note</span>
          </button>
          <button className="create-action" onClick={() => handleCreateNote("reminder")}>
            <CalendarClock size={17} />
            <span>Reminder</span>
          </button>
        </section>

        <nav className="nav-block">
          {["active", "archive", "trash"].map((status) => (
            <button
              key={status}
              className={filters.status === status ? "is-active" : ""}
              onClick={() => setFilters((current) => ({ ...current, status }))}
            >
              {status === "archive" ? <Archive size={16} /> : status === "trash" ? <Trash2 size={16} /> : <Pin size={16} />}
              {status === "active" ? "Notes" : status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </nav>

        <section className="sidebar-section">
          <div className="section-title">
            <span>Folders</span>
            <button className="tiny-button" onClick={() => openFolderDialog(null)} title="Add folder">
              <Plus size={14} />
            </button>
          </div>
          <FolderTree
            folders={folders}
            activeFolder={filters.folder}
            onSelect={(folder) => setFilters((current) => ({ ...current, folder }))}
            onCreate={openFolderDialog}
          />
        </section>

        <section className="sidebar-section">
          <div className="section-title">Tags</div>
          <div className="tag-list">
            <button
              className={!filters.tag ? "tag-pill is-active" : "tag-pill"}
              onClick={() => setFilters((current) => ({ ...current, tag: "" }))}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag._id}
                className={filters.tag === tag.name ? "tag-pill is-active" : "tag-pill"}
                onClick={() => setFilters((current) => ({ ...current, tag: tag.name }))}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button className="icon-button sidebar-open-button" onClick={() => setSidebarOpen(true)} title="Open sidebar">
            <PanelLeft size={18} />
          </button>
          <label className="search-box">
            <Search size={18} />
            <input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search title, content, or tags"
            />
          </label>
          <div className={`save-state save-${saving}`}>
            {statusIcon[saving]}
            {saving === "saving" ? "Saving" : saving === "unsaved" ? "Unsaved changes" : "Saved"}
          </div>
          <div className="user-chip" title={auth.user?.email}>
            <span>{auth.user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
            <strong>{auth.user?.name || "User"}</strong>
          </div>
          <button className="icon-button" onClick={logout} title="Log out">
            <LogOut size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title="Toggle theme"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        {notice ? (
          <div className="notice-bar">
            <AlertTriangle size={16} />
            <span>{notice}</span>
            {!apiReady ? <button onClick={checkApi}>Retry API</button> : null}
            <button onClick={() => setNotice("")}>Dismiss</button>
          </div>
        ) : null}

        <div className="content-grid">
          <NoteList notes={notes} selectedId={selectedId} onSelect={selectNote} />

          <section className="editor-panel">
            {selectedId ? (
              <>
                <div className="note-actions">
                  <button className={focusMode ? "is-pressed" : ""} onClick={() => setFocusMode((current) => !current)} title={focusMode ? "Exit focus mode" : "Focus mode"}>
                    {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    <span>{focusMode ? "Exit Focus" : "Focus"}</span>
                  </button>
                  <button className={selectedNote?.isPinned ? "is-pressed" : ""} onClick={togglePin} title="Pin note">
                    <Pin size={16} />
                    <span>{selectedNote?.isPinned ? "Unpin" : "Pin"}</span>
                  </button>
                  <button onClick={toggleArchive} title="Archive note">
                    <Archive size={16} />
                    <span>{selectedNote?.isArchived ? "Unarchive" : "Archive"}</span>
                  </button>
                  <button onClick={shareCurrentNote} title="Share note">
                    <Share2 size={16} />
                    <span>Share</span>
                  </button>
                  <button onClick={duplicateCurrentNote} title="Duplicate note">
                    <Copy size={16} />
                    <span>Duplicate</span>
                  </button>
                  {filters.status === "trash" ? (
                    <>
                      <button onClick={restoreFromTrash}>
                        <RotateCcw size={16} />
                        <span>Restore</span>
                      </button>
                      <button className="danger" onClick={deleteForever}>
                        <Trash2 size={16} />
                        <span>Delete forever</span>
                      </button>
                    </>
                  ) : (
                    <button className="danger" onClick={moveToTrash}>
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                <Editor
                  draft={draft}
                  folders={folders}
                  versions={versions}
                  onChange={updateDraft}
                  onMove={moveCurrentNote}
                  onReminder={saveReminder}
                  onNotice={setNotice}
                  onRestoreVersion={async (versionId) => {
                    try {
                      const restored = await restoreVersion(selectedId, versionId);
                      setDraft({ ...emptyDraft, ...restored, folder: restored.folder || null });
                      refreshCurrent();
                    } catch (error) {
                      showError(error, "Could not restore version");
                    }
                  }}
                />
              </>
            ) : (
              <div className="empty-state">
                <Bell size={28} />
                <h2>No note selected</h2>
                <p>Create a note or pick one from the list.</p>
                <button className="primary-action" onClick={handleCreateNote}>
                  <FileText size={18} />
                  New note
                </button>
              </div>
            )}
          </section>
        </div>

        {selectedNote?.updatedAt ? (
          <div className="last-edited">
            Last edited {formatDistanceToNow(new Date(selectedNote.updatedAt), { addSuffix: true })}
          </div>
        ) : null}
      </main>

      {folderDialog.open ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeFolderDialog}>
          <form className="folder-modal" onSubmit={handleCreateFolder} onMouseDown={(event) => event.stopPropagation()}>
            <div className="folder-modal-icon">
              <span className="folder-mark" style={{ "--folder-color": "#13776d" }}>
                <span />
              </span>
            </div>
            <div>
              <h2>New folder</h2>
              <p>{folderDialog.parent ? "Create a nested folder for this collection." : "Create a focused space for related notes."}</p>
            </div>
            <label>
              Folder name
              <input
                autoFocus
                value={folderDialog.name}
                onChange={(event) => setFolderDialog((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. My Days"
                required
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={closeFolderDialog}>Cancel</button>
              <button className="primary-action" disabled={folderDialog.busy}>
                <Plus size={16} />
                {folderDialog.busy ? "Creating" : "Create folder"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

