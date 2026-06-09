"use client";

import { useState, useEffect } from "react";
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
    name: "Daily Retrospective",
    title: "Daily Review - " + new Date().toLocaleDateString(),
    content: `# Daily Review\n\n**Focus Area**:\n- [ ] Main project deliverable focus\n\n**Wins of the Day**:\n- Solved critical setup issues\n\n**Blockers & Friction**:\n- None encountered\n\n**Next Action Items**:\n- [ ] Prep tomorrow's tasks`,
    tags: ["daily", "review"],
  },
  {
    name: "Feature Spec",
    title: "Feature Specification",
    content: `# Feature Spec\n\n**Problem Statement**:\n- What are we trying to solve?\n\n**Proposed Design**:\n- Clean, modern layout using Notion-style properties.\n\n**Success Criteria**:\n- [ ] Fast rendering\n- [ ] Smooth editor toggles`,
    tags: ["engineering", "design"],
  },
  {
    name: "Milestone Action Plan",
    title: "Milestone Action Plan",
    content: `# Milestone Action Plan\n\n**Goal Description**:\n- What is the milestone goal?\n\n**Key Action Checklist**:\n- [ ] Initialize repository structure\n- [ ] Wireframe critical layouts\n- [ ] Deploy staging build`,
    tags: ["strategy", "planning"],
  },
];

// Notion Emojis
const EMOJIS = ["📝", "🚀", "💡", "🎯", "🧠", "💻", "📅", "📈", "🌿", "🛠️", "🔥", "🎨"];

// Notion Covers
const COVERS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=1200&q=80",
  "https://images.unsplash.com/photo-1618005198143-d36639c63148?w=1200&q=80"
];

// Helper to determine tag color deterministically
function getTagColor(tagName: string): string {
  const colors = ["gray", "orange", "blue", "green", "purple", "red", "pink"];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

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

  // Notion metadata states
  const [pageIcon, setPageIcon] = useState("📝");
  const [pageCover, setPageCover] = useState("");
  const [isFullWidth, setIsFullWidth] = useState(false);

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

  // Popovers Toggles
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

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
    setPageIcon(metadata.icon || "📝");
    setPageCover(metadata.cover || "");
    setIsFullWidth(metadata.isFullWidth || false);
  };

  const startNewEntry = () => {
    setSelectedId(null);
    setTitle("Untitled Page");
    setContent("");
    setTags([]);
    setLinks([]);
    setPageIcon("📝");
    setPageCover("");
    setIsFullWidth(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveStatus("saving");

    const payload = {
      title: title || "Untitled Page",
      content,
      tags,
      metadata: {
        links,
        icon: pageIcon,
        cover: pageCover,
        isFullWidth,
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
    if (!selectedId || !confirm("Are you sure you want to delete this page?")) return;

    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("id", selectedId);

    if (!error) {
      setSelectedId(null);
      startNewEntry();
      fetchEntries();
    } else {
      alert("Error deleting page: " + error.message);
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

    // Save changes instantly
    if (selectedId && user) {
      setSaveStatus("saving");
      const { error } = await supabase
        .from("journal_entries")
        .update({ content: updatedContent })
        .eq("id", selectedId);
      
      if (!error) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
        // Refresh index
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

  // Tags Actions
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  // Templates Actions
  const handleLoadTemplate = (template: typeof TEMPLATES[0]) => {
    setTitle(template.title);
    setContent(template.content);
    setTags(template.tags);
  };

  // URL Cards Attachments Actions
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
      description: urlDesc.trim() || "Reference note.",
    };

    setLinks([...links, newLink]);
    setUrlInput("");
    setUrlTitle("");
    setUrlDesc("");
  };

  const handleRemoveLink = (linkId: string) => {
    setLinks(links.filter(l => l.id !== linkId));
  };

  // Search filtering
  const filteredEntries = entries.filter((e) => {
    const query = searchQuery.toLowerCase();
    const matchesTitle = e.title?.toLowerCase().includes(query);
    const matchesContent = e.content?.toLowerCase().includes(query);
    const matchesTags = e.tags?.some((t: string) => t.toLowerCase().includes(query));
    return matchesTitle || matchesContent || matchesTags;
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#191919] flex items-center justify-center text-sm text-neutral-500">
        VERIFYING_IDENTITY...
      </div>
    );
  }

  const selectedEntry = entries.find(e => e.id === selectedId);

  return (
    <main className="journal-dashboard animate-fade">
      {/* Notion Sidebar */}
      <aside className={`journal-sidebar ${isSidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand-wrapper">
            <span>📓 Notion Workspace</span>
          </div>
          <button 
            className="sidebar-btn-collapse"
            onClick={() => setIsSidebarOpen(false)}
          >
            ◀
          </button>
        </div>

        <button 
          className="sidebar-btn-action text-[11px] font-semibold" 
          onClick={() => router.push("/admin/dashboard")}
        >
          <span>◀</span> Return to Control Panel
        </button>

        <button className="sidebar-btn-action text-white font-medium bg-[rgba(255,255,255,0.03)]" onClick={startNewEntry}>
          <span>+</span> Add a Page
        </button>

        <div className="px-1">
          <input 
            type="text" 
            placeholder="Quick Find page..." 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="entries-list">
          {filteredEntries.map((e) => {
            const icon = e.metadata?.icon || "📝";
            return (
              <button
                key={e.id}
                className={`journal-card-link ${selectedId === e.id ? "active" : ""}`}
                onClick={() => loadEntry(e)}
              >
                <span className="entry-list-icon">{icon}</span>
                <span className="entry-list-title-text">{e.title || "Untitled Page"}</span>
              </button>
            );
          })}
          {filteredEntries.length === 0 && (
            <div className="text-neutral-600 text-xs italic text-center py-6">
              No pages found.
            </div>
          )}
        </div>
      </aside>

      {/* Notion Page Workspace */}
      <section className="journal-main">
        {/* Workspace controls header */}
        <header className="workspace-header">
          <div className="workspace-header-left">
            {!isSidebarOpen && (
              <button 
                className="btn-notion-flat" 
                onClick={() => setIsSidebarOpen(true)}
              >
                Index ▶
              </button>
            )}
            <div className="save-notification">
              <span className={`status-indicator ${saveStatus}`} />
              <span className="text-xs text-neutral-500 font-medium ml-1">
                {saveStatus === "saving" ? "Saving..." : "All changes saved"}
              </span>
            </div>
          </div>

          <div className="workspace-header-actions">
            {/* View toggles */}
            <button 
              className={`btn-notion-flat ${layoutMode === "split" ? "primary" : ""}`}
              onClick={() => setLayoutMode("split")}
            >
              Split View
            </button>
            <button 
              className={`btn-notion-flat ${layoutMode === "canvas-editor" ? "primary" : ""}`}
              onClick={() => setLayoutMode("canvas-editor")}
            >
              Focus Editor
            </button>
            <button 
              className={`btn-notion-flat ${layoutMode === "canvas-preview" ? "primary" : ""}`}
              onClick={() => setLayoutMode("canvas-preview")}
            >
              Preview Mode
            </button>

            <span className="h-4 w-px bg-neutral-800 mx-1" />

            <button 
              className={`btn-notion-flat ${isFullWidth ? "primary" : ""}`}
              onClick={() => setIsFullWidth(!isFullWidth)}
            >
              Full Width
            </button>

            <button className="btn-notion-flat primary" onClick={handleSave}>
              Save
            </button>

            {selectedId && (
              <button className="btn-notion-flat danger" onClick={handleDeleteEntry}>
                Delete
              </button>
            )}
          </div>
        </header>

        {/* Workspace Panels */}
        <div className={`workspace-panels canvas-${layoutMode}`}>
          {/* EDITOR CANVAS */}
          <div className="editor-panel">
            {/* Cover image header */}
            {pageCover ? (
              <div className="notion-cover-wrapper">
                <img src={pageCover} alt="Page Cover" className="notion-cover-img" />
                <div className="notion-cover-overlay">
                  <button type="button" className="btn-notion-flat bg-[#252525]" onClick={() => setPageCover("")}>
                    Remove Cover
                  </button>
                  <button type="button" className="btn-notion-flat bg-[#252525] ml-2" onClick={() => setShowCoverPicker(!showCoverPicker)}>
                    Change Cover
                  </button>
                </div>
              </div>
            ) : null}

            {/* Notion Center Text Column */}
            <div className={`notion-page-container ${isFullWidth ? "full-width" : "centered-width"}`}>
              {/* Emoji overlapping Cover */}
              <div className={`page-icon-wrapper ${pageCover ? "" : "no-cover"}`}>
                <div 
                  className="page-emoji-display"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  {pageIcon}
                </div>
                
                {showEmojiPicker && (
                  <div className="emoji-picker-popover">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-option"
                        onClick={() => {
                          setPageIcon(emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cover image trigger if none present */}
              {!pageCover && (
                <div className="mb-4 flex gap-2">
                  <button 
                    type="button" 
                    className="btn-notion-flat text-xs bg-neutral-900 border border-neutral-800"
                    onClick={() => setShowCoverPicker(!showCoverPicker)}
                  >
                    🎨 Add Cover
                  </button>
                </div>
              )}

              {showCoverPicker && (
                <div className="cover-picker-popover">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-2">Select cover gradient</span>
                  <div className="cover-picker-grid">
                    {COVERS.map((covUrl, idx) => (
                      <img
                        key={idx}
                        src={covUrl}
                        alt={`Cover option ${idx}`}
                        className="cover-thumbnail"
                        onClick={() => {
                          setPageCover(covUrl);
                          setShowCoverPicker(false);
                        }}
                      />
                    ))}
                  </div>
                  <button 
                    type="button" 
                    className="btn-notion-flat text-xs mt-2 w-full justify-center bg-neutral-900"
                    onClick={() => setShowCoverPicker(false)}
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Templates select bar */}
              <div className="notion-templates-bar">
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest self-center mr-2">Use template:</span>
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    className="notion-template-btn"
                    onClick={() => handleLoadTemplate(tmpl)}
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>

              {/* Title input */}
              <input 
                type="text" 
                className="notion-title-input" 
                placeholder="Untitled Page" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              {/* Notion Properties Database Panel */}
              <div className="notion-properties-block">
                {/* Date Property Row */}
                <div className="property-row">
                  <span className="property-label">📅 Created Time</span>
                  <div className="property-value text-neutral-500">
                    {selectedEntry ? new Date(selectedEntry.created_at).toLocaleString() : "Now"}
                  </div>
                </div>

                {/* Tags Property Row */}
                <div className="property-row">
                  <span className="property-label">🏷️ Tags</span>
                  <div className="property-value">
                    {tags.map((t) => {
                      const color = getTagColor(t);
                      return (
                        <span key={t} className={`notion-tag color-${color}`}>
                          {t}
                          <button 
                            type="button" 
                            className="notion-tag-btn-remove"
                            onClick={() => handleRemoveTag(t)}
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                    <input 
                      type="text"
                      className="notion-tag-input"
                      placeholder="Type & press Enter..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                    />
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <textarea 
                className="notion-content-area"
                placeholder="Press Enter to write thoughts, tasks (- [ ] task) and notes in markdown..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              {/* Notion Reference Resources Drawer */}
              <div className="notion-bookmarks-drawer">
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-3">Bookmarks & Attachments</span>
                
                <div className="notion-bookmark-add">
                  <input 
                    type="text" 
                    className="flex-1"
                    placeholder="URL (e.g. github.com)" 
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                  />
                  <input 
                    type="text" 
                    className="w-1/4"
                    placeholder="Label/Title" 
                    value={urlTitle}
                    onChange={(e) => setUrlTitle(e.target.value)}
                  />
                  <input 
                    type="text" 
                    className="w-1/3"
                    placeholder="Note" 
                    value={urlDesc}
                    onChange={(e) => setUrlDesc(e.target.value)}
                  />
                  <button type="button" className="btn-notion-flat bg-neutral-900 border border-neutral-800" onClick={handleAddLink}>
                    Attach
                  </button>
                </div>

                <div className="notion-bookmarks-grid">
                  {links.map((link) => (
                    <div key={link.id} className="notion-bookmark-card">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="bookmark-title"
                      >
                        🔗 {link.title}
                      </a>
                      <span className="bookmark-domain">{link.url}</span>
                      {link.description && <p className="bookmark-desc">{link.description}</p>}
                      <button 
                        type="button" 
                        className="btn-bookmark-delete" 
                        onClick={() => handleRemoveLink(link.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PREVIEW CANVAS */}
          <div className="preview-panel">
            {pageCover && (
              <div className="notion-cover-wrapper">
                <img src={pageCover} alt="Cover" className="notion-cover-img" />
              </div>
            )}

            <div className={`notion-page-container ${isFullWidth ? "full-width" : "centered-width"}`}>
              <div className={`page-icon-wrapper ${pageCover ? "" : "no-cover"}`}>
                <div className="page-emoji-display">{pageIcon}</div>
              </div>

              <div className="border-b border-neutral-900 pb-4 mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">{title || "Untitled Page"}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((t) => {
                    const color = getTagColor(t);
                    return (
                      <span key={t} className={`notion-tag color-${color}`}>
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="markdown-body">
                {parseMarkdown(content, handleToggleCheckbox)}
              </div>

              {links.length > 0 && (
                <div className="notion-bookmarks-drawer mt-10">
                  <h3 className="text-xs font-semibold text-neutral-500 mb-4 uppercase tracking-widest">Linked Resources</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {links.map((link) => (
                      <div key={link.id} className="notion-bookmark-card">
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="bookmark-title"
                        >
                          🔗 {link.title}
                        </a>
                        <span className="bookmark-domain">{link.url}</span>
                        {link.description && <p className="bookmark-desc">{link.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
