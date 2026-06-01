import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import ReactQuill, { Quill } from "react-quill-new";
import remarkGfm from "remark-gfm";
import {
  CalendarClock,
  Check,
  Code2,
  Eraser,
  Heading2,
  ImagePlus,
  Italic,
  Link,
  ListChecks,
  Mic,
  Palette,
  Plus,
  Quote,
  RotateCcw,
  Table2,
  Trash2,
  Type,
  UploadCloud
} from "lucide-react";
import { uploadImage } from "../api/client.js";
import { escapeHtml, htmlToText, tagsFromInput, tagsToInput } from "../utils/text.js";

const BaseImage = Quill.import("formats/image");

class ResizableImage extends BaseImage {
  static create(value) {
    const src = typeof value === "object" ? value.url : value;
    const node = super.create(src);
    const width = typeof value === "object" ? value.width : null;

    if (width) {
      node.style.width = width;
      node.style.maxWidth = "100%";
      node.style.height = "auto";
      node.setAttribute("data-width", width);
    }

    return node;
  }

  static formats(domNode) {
    const formats = super.formats?.(domNode) || {};
    const width = domNode.getAttribute("data-width") || domNode.style.width;

    if (width) {
      formats.width = width;
    }

    return formats;
  }

  format(name, value) {
    if (name === "width") {
      if (value) {
        this.domNode.style.width = value;
        this.domNode.style.maxWidth = "100%";
        this.domNode.style.height = "auto";
        this.domNode.setAttribute("data-width", value);
      } else {
        this.domNode.style.removeProperty("width");
        this.domNode.removeAttribute("data-width");
      }
      return;
    }

    super.format(name, value);
  }
}

Quill.register(ResizableImage, true);

function flattenFolders(folders, depth = 0) {
  return folders.flatMap((folder) => [
    { ...folder, label: `${"  ".repeat(depth)}${folder.name}` },
    ...flattenFolders(folder.children || [], depth + 1)
  ]);
}

const noteColors = [
  { name: "White", value: "#ffffff" },
  { name: "Yellow", value: "#fde68a" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Lavender", value: "#ddd6fe" },
  { name: "Coral", value: "#fecaca" },
  { name: "Peach", value: "#fed7aa" }
];

function getTypedChecklistItems(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^(?:☑|✅|✔|(?:[-*]\s*)?\[[xX]\])(?:\s+|$)/.test(line)) {
        return { checked: true };
      }

      if (/^(?:☐|⬜|□|(?:[-*]\s*)?\[\s\])(?:\s+|$)/.test(line)) {
        return { checked: false };
      }

      return null;
    })
    .filter(Boolean);
}

function getChecklistProgress(draft) {
  const structuredItems = (draft.checklist || [])
    .filter((item) => item.text?.trim())
    .map((item) => ({ checked: Boolean(item.checked) }));
  const typedItems = getTypedChecklistItems(`${htmlToText(draft.content || "")}\n${draft.markdown || ""}`);
  const items = [...structuredItems, ...typedItems];
  const total = items.length;
  const completed = items.filter((item) => item.checked).length;

  if (!total) {
    return { total: 0, completed: 0, progress: null };
  }

  return {
    total,
    completed,
    progress: completed === total ? 100 : Math.floor((completed / total) * 10) * 10
  };
}

function RichTextToolbar() {
  return (
    <div id="noted-rich-toolbar" className="noted-rich-toolbar">
      <div className="toolbar-group">
        <button className="ql-header toolbar-command wide" value="2" title="Heading">
          <Heading2 size={16} />
        </button>
        <button className="ql-bold toolbar-command" title="Bold">
          <Type size={16} />
        </button>
        <button className="ql-italic toolbar-command" title="Italic">
          <Italic size={16} />
        </button>
      </div>
      <div className="toolbar-group">
        <button className="ql-list toolbar-command wide" value="check" title="Checklist">
          <ListChecks size={16} />
        </button>
        <button className="ql-code-block toolbar-command wide" title="Code Block">
          <Code2 size={16} />
        </button>
        <button className="ql-blockquote toolbar-command wide" title="Quote">
          <Quote size={16} />
        </button>
        <button className="ql-table toolbar-command wide" title="Table">
          <Table2 size={16} />
        </button>
      </div>
      <div className="toolbar-group">
        <button className="ql-link toolbar-command" title="Link">
          <Link size={16} />
        </button>
        <button className="ql-clean toolbar-command" title="Clear formatting">
          <Eraser size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Editor({
  draft,
  folders,
  versions,
  onChange,
  onMove,
  onReminder,
  onNotice,
  onRestoreVersion
}) {
  const [tab, setTab] = useState("rich");
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [selectedImageWidth, setSelectedImageWidth] = useState(70);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const quillRef = useRef(null);
  const imageInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const folderOptions = useMemo(() => flattenFolders(folders), [folders]);
  const speechSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const editorStats = useMemo(() => {
    const text = `${htmlToText(draft.content || "")} ${draft.markdown || ""} ${(draft.checklist || [])
      .map((item) => item.text)
      .join(" ")}`.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    return {
      words,
      checklist: getChecklistProgress(draft)
    };
  }, [draft.checklist, draft.content, draft.markdown]);

  const insertImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onNotice?.("Choose an image file to upload.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onNotice?.("Images must be 5 MB or smaller.");
      return;
    }

    try {
      setUploadingImage(true);
      const uploaded = await uploadImage(file);
      const editor = quillRef.current?.getEditor();
      const range = editor?.getSelection(true);
      const imageIndex = range?.index || 0;

      editor?.insertEmbed(imageIndex, "image", uploaded.url, "user");
      editor?.formatText(imageIndex, 1, "width", "70%", "user");
      editor?.setSelection(imageIndex + 1, 0, "silent");

      window.setTimeout(() => {
        const image = editor?.root.querySelectorAll("img")?.[editor.root.querySelectorAll("img").length - 1];
        image?.classList.add("selected-note-image");
        setSelectedImage(image || null);
        setSelectedImageIndex(imageIndex);
        setSelectedImageWidth(70);
        onChange({
          content: editor?.root.innerHTML || draft.content,
          imageUrls: [...(draft.imageUrls || []), uploaded.url]
        });
      }, 0);
    } catch (error) {
      onNotice?.(error?.response?.data?.message || error.message || "Image upload failed. Check Cloudinary settings.");
    } finally {
      setUploadingImage(false);
    }
  };

  const resizeSelectedImage = (width) => {
    if (!selectedImage || selectedImageIndex === null) return;
    const editor = quillRef.current?.getEditor();
    const formattedWidth = `${width}%`;

    editor?.formatText(selectedImageIndex, 1, "width", formattedWidth, "user");
    selectedImage.style.width = formattedWidth;
    selectedImage.setAttribute("data-width", formattedWidth);
    setSelectedImageWidth(width);
    onChange({ content: editor?.root.innerHTML || draft.content });
  };

  const handleEditorClick = (event) => {
    const target = event.target;
    const editor = quillRef.current?.getEditor();
    editor?.root.querySelectorAll("img").forEach((image) => image.classList.remove("selected-note-image"));

    if (target?.tagName === "IMG") {
      target.classList.add("selected-note-image");
      const blot = Quill.find(target);
      const index = blot ? editor?.getIndex(blot) : null;
      setSelectedImage(target);
      setSelectedImageIndex(Number.isFinite(index) ? index : null);
      const width = Number.parseInt(target.getAttribute("data-width") || target.style.width, 10);
      setSelectedImageWidth(Number.isFinite(width) ? width : 70);
    } else {
      setSelectedImage(null);
      setSelectedImageIndex(null);
    }
  };

  const insertTable = () => {
    const editor = quillRef.current?.getEditor();
    const range = editor?.getSelection(true);
    const table = `
      <table>
        <tbody>
          <tr><th>Column 1</th><th>Column 2</th></tr>
          <tr><td>Item</td><td>Detail</td></tr>
        </tbody>
      </table>
    `;
    editor?.clipboard.dangerouslyPasteHTML(range?.index || 0, table);
  };

  const modules = useMemo(
    () => ({
      toolbar: {
        container: "#noted-rich-toolbar",
        handlers: {
          image: () => imageInputRef.current?.click(),
          table: insertTable
        }
      },
      clipboard: { matchVisual: false }
    }),
    []
  );

  const addChecklistItem = () => {
    onChange({
      checklist: [...(draft.checklist || []), { text: "New task", checked: false }]
    });
  };

  const updateChecklistItem = (index, patch) => {
    const checklist = [...(draft.checklist || [])];
    checklist[index] = { ...checklist[index], ...patch };
    onChange({ checklist });
  };

  const deleteChecklistItem = (index) => {
    onChange({
      checklist: (draft.checklist || []).filter((_, itemIndex) => itemIndex !== index)
    });
  };

  const startVoiceNote = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onNotice?.("Speech recognition is not supported in this browser. Use Chrome or Edge on localhost.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      setVoiceStatus("Finishing voice note...");
      return;
    }

    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      stream?.getTracks().forEach((track) => track.stop());
    } catch {
      onNotice?.("Microphone permission is required for voice notes. Allow microphone access in the browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    let finalTranscript = "";
    recognition.lang = navigator.language || "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          finalTranscript += `${event.results[index][0].transcript.trim()} `;
        } else {
          interimTranscript += event.results[index][0].transcript;
        }
      }

      setVoiceStatus(interimTranscript ? `Listening: ${interimTranscript}` : "Listening...");
    };

    recognition.onerror = (event) => {
      setListening(false);
      setVoiceStatus("");
      onNotice?.(`Voice note stopped: ${event.error || "microphone error"}`);
    };

    recognition.onend = () => {
      setListening(false);
      const cleanTranscript = finalTranscript.trim();
      if (!cleanTranscript) return;
      onChange({
        content: `${draft.content || ""}<p>${escapeHtml(cleanTranscript)}</p>`,
        markdown: `${draft.markdown ? `${draft.markdown}\n\n` : ""}${cleanTranscript}`
      });
      setVoiceStatus("");
    };

    recognitionRef.current = recognition;
    setListening(true);
    setVoiceStatus("Listening...");

    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceStatus("");
      onNotice?.("Voice note could not start. Try again after allowing microphone access.");
    }
  };

  return (
    <div
      className={dragActive ? "editor is-dragging" : "editor"}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
        if (!file) {
          onNotice?.("Drop an image file to add it to this note.");
          return;
        }
        insertImage(file);
      }}
    >
      {dragActive ? (
        <div className="editor-drop-overlay">
          <UploadCloud size={30} />
          <strong>Drop image to add it to this note</strong>
          <span>It will upload and appear inside the editor.</span>
        </div>
      ) : null}

      <input
        className="title-input"
        value={draft.title}
        onChange={(event) => onChange({ title: event.target.value })}
        placeholder="Untitled note"
      />

      <div className="properties-row">
        <select value={draft.folder || ""} onChange={(event) => onMove(event.target.value || null)}>
          <option value="">No folder</option>
          {folderOptions.map((folder) => (
            <option key={folder._id} value={folder._id}>
              {folder.label}
            </option>
          ))}
        </select>
        <input
          value={tagsToInput(draft.tags)}
          onChange={(event) => onChange({ tags: tagsFromInput(event.target.value) })}
          placeholder="tags, separated, by comma"
        />
        <div className="note-color-picker" title="Note color">
          <Palette size={16} />
          {noteColors.map((color) => (
            <button
              key={color.value}
              className={draft.color === color.value ? "color-swatch is-active" : "color-swatch"}
              style={{ "--swatch": color.value }}
              title={color.name}
              aria-label={`${color.name} note color`}
              onClick={() => onChange({ color: color.value })}
            />
          ))}
        </div>
        <label className="reminder-control">
          <CalendarClock size={16} />
          <input
            type="datetime-local"
            value={draft.reminderAt || ""}
            onChange={(event) => onChange({ reminderAt: event.target.value })}
          />
        </label>
        <input
          value={draft.reminderEmail || ""}
          onChange={(event) => onChange({ reminderEmail: event.target.value })}
          placeholder="email reminder"
          type="email"
        />
        <button className="compact-button" onClick={onReminder}>
          <Check size={15} />
          Set
        </button>
      </div>

      <div className="tab-row">
        {[
          ["rich", "Rich text"],
          ["markdown", "Markdown"],
          ["checklist", "Checklist"],
          ["history", "History"]
        ].map(([value, label]) => (
          <button key={value} className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
        <button className="compact-button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
          <ImagePlus size={15} />
          {uploadingImage ? "Uploading..." : "Upload image"}
        </button>
        <button
          className={listening ? "compact-button is-recording" : "compact-button"}
          onClick={startVoiceNote}
          disabled={!speechSupported}
          title={speechSupported ? "Start voice note" : "Voice notes need Chrome or Edge speech recognition"}
        >
          <Mic size={15} />
          {speechSupported ? (listening ? "Stop recording" : "Voice note") : "Voice unsupported"}
        </button>
      </div>

      {voiceStatus ? <div className="voice-status">{voiceStatus}</div> : null}

      <input
        ref={imageInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => {
          insertImage(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {tab === "rich" ? (
        <div onClick={handleEditorClick}>
          {selectedImage ? (
            <div className="image-resize-control">
              <span>Image size</span>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={selectedImageWidth}
                onChange={(event) => resizeSelectedImage(Number(event.target.value))}
              />
              <strong>{selectedImageWidth}%</strong>
            </div>
          ) : null}
          <RichTextToolbar />
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={draft.content}
            onChange={(content) => onChange({ content })}
            modules={modules}
            placeholder="Write something future-you will thank you for..."
          />
        </div>
      ) : null}

      {tab === "markdown" ? (
        <div className="markdown-grid">
          <textarea
            value={draft.markdown || ""}
            onChange={(event) => onChange({ markdown: event.target.value })}
            placeholder="# Markdown note"
          />
          <div className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.markdown || "_Markdown preview_"}</ReactMarkdown>
          </div>
        </div>
      ) : null}

      {tab === "checklist" ? (
        <div className="checklist-panel">
          <button className="compact-button" onClick={addChecklistItem}>
            <Plus size={15} />
            Add task
          </button>
          {(draft.checklist || []).map((item, index) => (
            <div className="checklist-row" key={item._id || index}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => updateChecklistItem(index, { checked: event.target.checked })}
                aria-label={`Mark task ${index + 1} as ${item.checked ? "incomplete" : "complete"}`}
              />
              <input
                value={item.text}
                onChange={(event) => updateChecklistItem(index, { text: event.target.value })}
                aria-label={`Checklist task ${index + 1}`}
              />
              <button
                className="tiny-button checklist-delete"
                type="button"
                title="Delete task"
                aria-label={`Delete checklist task ${index + 1}`}
                onClick={() => deleteChecklistItem(index)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!draft.checklist?.length ? (
            <div className="quiet-empty">
              <ListChecks size={22} />
              Add checklist tasks for this note.
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="history-list">
          {versions.map((version) => (
            <div className="history-item" key={version._id}>
              <div>
                <strong>{version.reason}</strong>
                <span>{new Date(version.createdAt).toLocaleString()}</span>
              </div>
              <button onClick={() => onRestoreVersion(version._id)}>
                <RotateCcw size={15} />
                Restore
              </button>
            </div>
          ))}
          {!versions.length ? <div className="quiet-empty">No versions yet.</div> : null}
        </div>
      ) : null}

      <div className="editor-stats" aria-label="Writing stats">
        {editorStats.checklist.total ? (
          <span className="editor-progress">
            <span>Progress: {editorStats.checklist.progress}%</span>
            <span className="progress-track" aria-hidden="true">
              <span style={{ width: `${editorStats.checklist.progress}%` }} />
            </span>
          </span>
        ) : null}
        <span>Words: {editorStats.words}</span>
      </div>
    </div>
  );
}

