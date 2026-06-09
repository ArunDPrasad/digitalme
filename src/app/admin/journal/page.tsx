"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import "./journal.css";

// Simple custom Markdown parser that handles checklists, headers, bold, and bullet points
function parseMarkdown(
  text: string,
  onToggleCheck: (index: number, checked: boolean) => void
) {
  if (!text) return <p className="text-neutral-500 italic">No content written yet.</p>;

  const lines = text.split("\n");
  let checklistIndex = 0;

  return lines.map((line, index) => {
    // 1. Checkboxes / Tasks: - [ ] or - [x]
    const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[2].toLowerCase() === "x";
      const taskText = taskMatch[3];
      const currentIdx = checklistIndex++;

      return (
        <div
          key={index}
          className={`preview-checkbox-item ${isChecked ? "checked" : ""}`}
          onClick={() => onToggleCheck(currentIdx, !isChecked)}
        >
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
          />
          <span>{taskText}</span>
        </div>
      );
    }

    // 2. Headers: #, ##, ###
    if (line.startsWith("### ")) {
      return <h3 key={index}>{line.slice(4)}</h3>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={index}>{line.slice(3)}</h2>;
    }
    if (line.startsWith("# ")) {
      return <h1 key={index}>{line.slice(2)}</h1>;
    }

    // 3. Bullet points: - item
    if (line.startsWith("- ")) {
      return <li key={index} className="ml-4 list-disc text-neutral-300">{line.slice(2)}</li>;
    }

    // 4. Empty line
    if (line.trim() === "") {
      return <div key={index} className="h-4" />;
    }

    // Bold formatting helper: **text** -> strong
    const parts = [];
    let remaining = line;
    let boldMatch;
    let partKey = 0;
    while ((boldMatch = remaining.match(/\*\*(.*?)\*\*/))) {
      const startIndex = boldMatch.index!;
      if (startIndex > 0) {
        parts.push(remaining.substring(0, startIndex));
      }
      parts.push(
        <strong key={partKey++} className="font-bold text-white">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.substring(startIndex + boldMatch[0].length);
    }
    parts.push(remaining);

    return <p key={index} className="my-1 text-neutral-300">{parts}</p>;
  });
}

// Preset writing templates
const TEMPLATES = [
  {
    name: "Daily Sync",
    title: "Daily Sync - " + new Date().toLocaleDateString(),
    content: `# Daily Sync\n\n**Focus Area**:\n- [ ] Focus on core feature delivery\n\n**Key Progress**:\n- Started task implementation\n\n**Blockers & Risks**:\n- None today\n\n**Mindset & Vision Alignment**:\n- Keep the Next5 target clear. Today's code moves the needle.`,
    tags: ["daily", "sync"],
  },
  {
    name: "Venture Design",
    title: "New Venture Concept",
    content: `# Venture Design Spec\n\n**Core Concept**:\n- Describe the product concept here...\n\n**Target Audience**:\n- Who needs this?\n\n**Technical Architecture**:\n- Frameworks: Next.js, Supabase, Tailwind\n- Key APIs:\n\n**Action Items / Roadmap**:\n- [ ] Draft Figma design wireframes\n- [ ] Initialize Supabase DB tables\n- [ ] Build landing MVP page`,
    tags: ["venture", "spec", "planning"],
  },
  {
    name: "Milestone Review",
    title: "Milestone Retrospective",
    content: `# Milestone Retrospective\n\n**Milestone Reached**:\n- Describe the milestone...\n\n**What Went Well**:\n- High speed development\n\n**What Failed / Learning Points**:\n- Need clearer scope definitions next time\n\n**Next Action Steps**:\n- [ ] Implement feedback iteration\n- [ ] Update public portfolio stats`,
    tags: ["retro", "milestone"],
  },
];

interface LinkItem {
  id: string;
  url: string;
  title: string;
  description: string;
}

export default function JournalDashboard() {
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [tagInput, setTagInput] = useState("");

  // URL Attachment Inputs
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlDesc, setUrlDesc] = useState("");

  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [layoutMode, setLayoutMode] = useState<"split" | "canvas-editor" | "canvas-preview">("split");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [user, setUser] = useState<any>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sudo-onboard");
      } else {
        setUser(user);
        fetchEntries();
      }
    };
    checkUser();
  }, [router, supabase]);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) {
      setEntries(data);
      // Automatically select the first entry if none is selected
      if (data.length > 0 && !selectedId) {
        loadEntry(data[0]);
      }
    }
  };

  const loadEntry = (entry: any) => {
    setSelectedId(entry.id);
    setTitle(entry.title || "");
    setContent(entry.content || "");
    setTags(entry.tags || []);
    
    // Parse links and metadata safely
    const metadata = entry.metadata || {};
    setLinks(metadata.links || []);
  };

  const startNewEntry = () => {
    setSelectedId(null);
    setTitle("New Reflection");
    setContent("");
    setTags([]);
    setLinks([]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveStatus("saving");

    const payload = {
      title: title || "Untitled Reflection",
      content,
      tags,
      metadata: {
        links,
      },
      user_id: user.id,
    };

    let error = null;

    if (selectedId) {
      const { error: updateError } = await supabase
        .from("journal_entries")
        .update(payload)
        .eq("id", selectedId);
      error = updateError;
    } else {
      const { data, error: insertError } = await supabase
        .from("journal_entries")
        .insert(payload)
        .select()
        .single();
      error = insertError;
      if (!error && data) {
        setSelectedId(data.id);
      }
    }

    if (!error) {
      setSaveStatus("saved");
      fetchEntries();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } else {
      alert("Error saving entry: " + error.message);
      setSaveStatus("idle");
    }
  };

  const handleDeleteEntry = async () => {
    if (!selectedId || !confirm("Are you sure you want to delete this entry?")) return;

    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", selectedId);

    if (!error) {
      setSelectedId(null);
      startNewEntry();
      fetchEntries();
    } else {
      alert("Error deleting entry: " + error.message);
    }
  };

  // Checklist Interactive Toggling inside preview
  const handleToggleCheckbox = async (checklistIdx: number, newChecked: boolean) => {
    let currentIdx = 0;
    const lines = content.split("\n");
    const updatedLines = lines.map((line) => {
      const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
      if (taskMatch) {
        if (currentIdx === checklistIdx) {
          const spacing = taskMatch[1];
          const taskText = taskMatch[3];
          const checkChar = newChecked ? "x" : " ";
          currentIdx++;
          return `${spacing}- [${checkChar}] ${taskText}`;
        }
        currentIdx++;
      }
      return line;
    });

    const updatedContent = updatedLines.join("\n");
    setContent(updatedContent);

    // If there is a selected ID, save it to the DB instantly for seamless interaction
    if (selectedId && user) {
      setSaveStatus("saving");
      const { error } = await supabase
        .from("journal_entries")
        .update({ content: updatedContent })
        .eq("id", selectedId);
      
      if (!error) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
        // Refresh entry lists in background
        const { data } = await supabase
          .from("journal_entries")
          .select("*")
          .order("created_at", { ascending: false });
        if (data) setEntries(data);
      } else {
        setSaveStatus("idle");
      }
    }
  };

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim().toLowerCase())) {
        setTags([...tags, tagInput.trim().toLowerCase()]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Load preset templates
  const handleLoadTemplate = (template: typeof TEMPLATES[0]) => {
    setTitle(template.title);
    setContent(template.content);
    setTags(template.tags);
  };

  // Attach URL Cards
  const handleAddLink = () => {
    if (!urlInput.trim()) return;

    let parsedUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(parsedUrl)) {
      parsedUrl = "https://" + parsedUrl;
    }

    let domain = "external link";
    try {
      domain = new URL(parsedUrl).hostname.replace("www.", "");
    } catch (_) {}

    const newLink: LinkItem = {
      id: crypto.randomUUID(),
      url: parsedUrl,
      title: urlTitle.trim() || domain,
      description: urlDesc.trim() || "Resource bookmark reference.",
    };

    setLinks([...links, newLink]);
    setUrlInput("");
    setUrlTitle("");
    setUrlDesc("");
  };

  const handleRemoveLink = (linkId: string) => {
    setLinks(links.filter(l => l.id !== linkId));
  };

  // Filter entries based on search query
  const filteredEntries = entries.filter((e) => {
    const query = searchQuery.toLowerCase();
    const matchesTitle = e.title?.toLowerCase().includes(query);
    const matchesContent = e.content?.toLowerCase().includes(query);
    const matchesTags = e.tags?.some((t: string) => t.toLowerCase().includes(query));
    return matchesTitle || matchesContent || matchesTags;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-sm font-bold text-neutral-400">
        VERIFYING_IDENTITY...
      </div>
    );
  }

  return (
    <main className="journal-dashboard animate-fade">
      {/* Sidebar List */}
      <aside className={`journal-sidebar ${isSidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-brand">
          <span>JOURNAL</span>
          <button 
            className="text-neutral-500 hover:text-white border-none bg-transparent cursor-pointer text-xs"
            onClick={() => setIsSidebarOpen(false)}
          >
            ◀ Collapse
          </button>
        </div>

        <button 
          className="btn-control text-[10px] uppercase tracking-wider py-1 px-2 mb-2" 
          onClick={() => router.push("/admin/dashboard")}
        >
          ◀ Return to HUD
        </button>

        <button className="btn-control primary w-full text-center justify-center font-bold" onClick={startNewEntry}>
          + New Entry
        </button>

        <div className="search-container">
          <input 
            type="text" 
            placeholder="Search entries or tags..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="entries-list">
          {filteredEntries.map((e) => (
            <button
              key={e.id}
              className={`journal-card-link ${selectedId === e.id ? "active" : ""}`}
              onClick={() => loadEntry(e)}
            >
              <div className="journal-card-date">
                {new Date(e.created_at).toLocaleDateString()}
              </div>
              <div className="journal-card-title">{e.title || "Untitled"}</div>
              <div className="journal-card-snippet">{e.content}</div>
            </button>
          ))}
          {filteredEntries.length === 0 && (
            <div className="text-neutral-600 text-xs italic text-center py-8">
              No entries found.
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace */}
      <section className="journal-main">
        {/* Workspace controls header */}
        <header className="workspace-header">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                className="btn-control text-xs" 
                onClick={() => setIsSidebarOpen(true)}
              >
                Index ▶
              </button>
            )}
            <div className="save-notification">
              <span className={`status-indicator ${saveStatus}`} />
              <span className="capitalize">{saveStatus === "idle" ? "All changes saved" : saveStatus + "..."}</span>
            </div>
          </div>

          <div className="workspace-actions">
            {/* View layout selectors */}
            <div className="mode-toggle">
              <button 
                className={`mode-btn ${layoutMode === "split" ? "active" : ""}`}
                onClick={() => setLayoutMode("split")}
              >
                Split View
              </button>
              <button 
                className={`mode-btn ${layoutMode === "canvas-editor" ? "active" : ""}`}
                onClick={() => setLayoutMode("canvas-editor")}
              >
                Focus Editor
              </button>
              <button 
                className={`mode-btn ${layoutMode === "canvas-preview" ? "active" : ""}`}
                onClick={() => setLayoutMode("canvas-preview")}
              >
                Preview Mode
              </button>
            </div>

            <button className="btn-control primary" onClick={handleSave}>
              Save Workspace
            </button>

            {selectedId && (
              <button className="btn-control danger" onClick={handleDeleteEntry}>
                Delete
              </button>
            )}
          </div>
        </header>

        {/* Panels */}
        <div className={`workspace-panels canvas-${layoutMode}`}>
          {/* EDITOR PANEL */}
          <div className="editor-panel">
            {/* Template Selector Bar */}
            <div className="templates-bar">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest self-center mr-2">Templates:</span>
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  type="button"
                  className="template-chip"
                  onClick={() => handleLoadTemplate(tmpl)}
                >
                  {tmpl.name}
                </button>
              ))}
            </div>

            <input 
              type="text" 
              className="title-input" 
              placeholder="Give your entry a title..." 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* Tag pills manager */}
            <div className="tags-manager">
              {tags.map((t) => (
                <span key={t} className="tag-pill">
                  #{t}
                  <button type="button" onClick={() => handleRemoveTag(t)}>×</button>
                </span>
              ))}
              <input 
                type="text"
                className="tag-input"
                placeholder="+ Add tag (press Enter)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
              />
            </div>

            <textarea 
              className="content-textarea"
              placeholder="What are we planning or building today? Use markdown headings (#) and tasks (- [ ] task) to structure your thoughts."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            {/* URL Bookmark attachments */}
            <div className="attachments-section">
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-3">Linked Resources</span>
              
              <div className="url-input-container">
                <input 
                  type="text" 
                  placeholder="Paste URL (e.g. github.com/user/repo)" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="Custom Link Title" 
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="Short note" 
                  value={urlDesc}
                  onChange={(e) => setUrlDesc(e.target.value)}
                />
                <button type="button" className="btn-control font-bold" onClick={handleAddLink}>
                  Attach Link
                </button>
              </div>

              <div className="links-grid">
                {links.map((link) => (
                  <div key={link.id} className="link-card">
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="link-card-title"
                    >
                      🔗 {link.title}
                    </a>
                    <span className="link-card-domain">
                      {link.url}
                    </span>
                    {link.description && (
                      <p className="link-card-desc">{link.description}</p>
                    )}
                    <button 
                      type="button" 
                      className="delete-link-btn" 
                      onClick={() => handleRemoveLink(link.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PREVIEW PANEL */}
          <div className="preview-panel">
            <div className="border-b border-neutral-800 pb-4">
              <div className="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-semibold">PREVIEW</div>
              <h1 className="text-2xl font-bold text-white mb-2">{title || "Untitled Entry"}</h1>
              
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="text-xs text-neutral-500 bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="markdown-body">
              {parseMarkdown(content, handleToggleCheckbox)}
            </div>

            {links.length > 0 && (
              <div className="border-t border-neutral-900 pt-6 mt-6">
                <h3 className="text-sm font-semibold text-neutral-400 mb-4 uppercase tracking-widest">Bookmarks & Specs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {links.map((link) => (
                    <div key={link.id} className="link-card">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="link-card-title"
                      >
                        🔗 {link.title}
                      </a>
                      <span className="link-card-domain">{link.url}</span>
                      {link.description && <p className="link-card-desc">{link.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
