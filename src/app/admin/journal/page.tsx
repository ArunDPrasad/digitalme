"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import "./journal.css";

export default function JournalDashboard() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dateTime, setDateTime] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date().toLocaleString());
    }, 1000);

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
    return () => clearInterval(timer);
  }, [router, supabase]);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEntries(data);
  };

  const handleSave = async () => {
    if (!content || !user) return;
    setIsSaving(true);
    
    const { error } = await supabase.from("journal_entries").insert({
      title: title || "Untitled Reflection",
      content,
      user_id: user.id
    });

    if (!error) {
      setTitle("");
      setContent("");
      fetchEntries();
    }
    setIsSaving(false);
  };

  if (!user) return <div className="min-h-screen bg-black flex items-center justify-center p-4">AUTHENTICATING_IDENTITY...</div>;

  return (
    <main className="journal-dashboard animate-fade">
      {/* Sidebar */}
      <aside className="journal-sidebar">
        <div className="terminal-header" style={{ border: 'none' }}>
          <div>MINDSET_LOG_V2</div>
          <div className="text-[10px] opacity-40 mt-1 uppercase tracking-widest">{dateTime}</div>
        </div>

        <button className="text-[10px] text-left border border-neutral-800 p-2 hover:border-accent transition-colors mb-4" onClick={() => router.push("/admin/dashboard")}>
          {"<"} RETURN_TO_HUD
        </button>
        
        <div className="flex flex-col gap-4 mt-4 overflow-y-auto max-h-[60vh]">
          {entries.map((entry) => (
            <div key={entry.id} className="prev-entry">
              <div className="prev-entry-date">{new Date(entry.created_at).toLocaleDateString()}</div>
              <div className="prev-entry-title">{entry.title}</div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="prev-entry opacity-50">
              <div className="prev-entry-date">DB_EMPTY</div>
              <div className="prev-entry-title">No historical reflections found.</div>
            </div>
          )}
        </div>

        <button className="sudo-btn mt-auto" onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}>
          TERMINATE_SESSION
        </button>
      </aside>

      {/* Main Content Area */}
      <section className="journal-main">
        <div className="entry-header">
          <input 
            type="text" 
            className="entry-title-input" 
            placeholder="[ENTRY_TITLE_HERE]" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <textarea 
          className="entry-content-area"
          placeholder="Initiate mind-dump. Reality check required. How is the 5-year vision progressing today?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {isSaving && <div className="save-status animate-pulse">SYNCING_TO_LAB_DATA...</div>}
        
        {!isSaving && content && (
          <button className="save-status" onClick={handleSave}>
            COMMIT_CHANGES [CMD+S]
          </button>
        )}
      </section>
    </main>
  );
}
