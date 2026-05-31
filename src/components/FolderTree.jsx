import { FolderPlus } from "lucide-react";

function CustomFolderIcon({ color = "#4f46e5", allNotes = false }) {
  return (
    <span className={allNotes ? "folder-mark all-notes" : "folder-mark"} style={{ "--folder-color": color }}>
      <span />
    </span>
  );
}

export default function FolderTree({ folders, activeFolder, onSelect, onCreate }) {
  return (
    <div className="folder-tree">
      <button className={!activeFolder ? "folder-row is-active" : "folder-row"} onClick={() => onSelect("")}>
        <CustomFolderIcon color="#13776d" allNotes />
        All notes
      </button>
      {folders.map((folder) => (
        <FolderNode key={folder._id} folder={folder} activeFolder={activeFolder} onSelect={onSelect} onCreate={onCreate} />
      ))}
    </div>
  );
}

function FolderNode({ folder, activeFolder, onSelect, onCreate, depth = 0 }) {
  return (
    <div>
      <div className={activeFolder === folder._id ? "folder-row is-active" : "folder-row"} style={{ paddingLeft: 10 + depth * 14 }}>
        <button onClick={() => onSelect(folder._id)}>
          <CustomFolderIcon color={folder.color} />
          {folder.name}
        </button>
        <button className="tiny-button" onClick={() => onCreate(folder._id)} title={`Add folder inside ${folder.name}`}>
          <FolderPlus size={13} />
        </button>
      </div>
      {folder.children?.map((child) => (
        <FolderNode
          key={child._id}
          folder={child}
          activeFolder={activeFolder}
          onSelect={onSelect}
          onCreate={onCreate}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
