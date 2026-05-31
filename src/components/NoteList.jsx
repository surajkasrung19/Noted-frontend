import { Archive, Clock, Pin, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NoteList({ notes, selectedId, onSelect }) {
  return (
    <section className="note-list">
      {notes.map((note) => (
        <button
          key={note._id}
          className={selectedId === note._id ? "note-card is-selected" : "note-card"}
          style={{ "--note-color": note.color || "#ffffff" }}
          onClick={() => onSelect(note._id)}
        >
          <div className="note-card-top">
            <strong>{note.title || "Untitled note"}</strong>
            <span className="note-icons">
              {note.isPinned ? <Pin size={14} /> : null}
              {note.isArchived ? <Archive size={14} /> : null}
              {note.trashedAt ? <Trash2 size={14} /> : null}
            </span>
          </div>
          <p>{note.plainText || "Capture an idea before it disappears."}</p>
          <div className="note-meta">
            <Clock size={13} />
            {formatDistanceToNow(new Date(note.updatedAt || note.createdAt), { addSuffix: true })}
          </div>
          {note.tags?.length ? (
            <div className="inline-tags">
              {note.tags.slice(0, 3).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </button>
      ))}

      {!notes.length ? (
        <div className="list-empty">
          <strong>No matching notes</strong>
          <span>Try a different folder, tag, or search.</span>
        </div>
      ) : null}
    </section>
  );
}
