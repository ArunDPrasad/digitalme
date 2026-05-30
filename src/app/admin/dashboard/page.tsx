"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import "./dashboard.css";

export default function DashboardHub() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSaving, setIsSaving] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Site Settings State
  const [settings, setSettings] = useState({
    id: "",
    bio: "",
    ventures_count: 0,
    experience_years: 0,
    next5_start_date: "2024-05-01",
    cover_url: "",
    cover_position_y: 50
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartPercentY = useRef<number>(50);
  const previewRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sudo-onboard");
      } else {
        setUser(user);
        fetchSettings();
      }
    };
    checkUser();
  }, [router, supabase]);

  const fetchSettings = async () => {
    const { data } = await supabase.from("site_settings").select("*").maybeSingle();
    if (data) {
      setSettings({
        id: data.id,
        bio: data.bio || "",
        ventures_count: data.ventures_count || 0,
        experience_years: data.experience_years || 0,
        next5_start_date: data.next5_start_date || "2024-05-01",
        cover_url: data.cover_url || "",
        cover_position_y: data.cover_position_y ?? 50
      });

      // Calculate Vision Progress
      const startDate = new Date(data.next5_start_date).getTime();
      const endDate = startDate + (5 * 365 * 24 * 60 * 60 * 1000); // 5 years later
      const now = Date.now();
      const total = endDate - startDate;
      const progress = Math.min(Math.max(((now - startDate) / total) * 100, 0), 100);
      setSyncProgress(progress);
    }
  };

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!settings.cover_url) return;
    e.preventDefault();
    setIsDragging(true);

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartPercentY.current = settings.cover_position_y ?? 50;
  };

  const handleDragMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || !settings.cover_url || !previewRef.current) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - dragStartY.current;
    const containerHeight = previewRef.current.clientHeight;
    
    const deltaPercent = (deltaY / containerHeight) * 100;
    let newPercentY = Math.round(dragStartPercentY.current - deltaPercent);
    newPercentY = Math.max(0, Math.min(100, newPercentY));
    
    setSettings(prev => ({ ...prev, cover_position_y: newPercentY }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be less than 5MB.");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `cover-${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("profile-media")
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, cover_url: publicUrl, cover_position_y: 50 }));
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetCover = () => {
    setSettings(prev => ({ ...prev, cover_url: "", cover_position_y: 50 }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const payload: any = {
      bio: settings.bio,
      ventures_count: settings.ventures_count,
      experience_years: settings.experience_years,
      next5_start_date: settings.next5_start_date,
      cover_url: settings.cover_url,
      cover_position_y: settings.cover_position_y,
      updated_at: new Date()
    };
    if (settings.id) {
      payload.id = settings.id;
    }

    const { data, error } = await supabase
      .from("site_settings")
      .upsert(payload)
      .select()
      .maybeSingle();

    if (!error && data) {
      setSettings(prev => ({ ...prev, id: data.id }));
      alert("Changes deployed to your public front-view.");
    } else if (error) {
      alert("Error saving settings: " + error.message);
    }
    setIsSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!user) return <div className="min-h-screen bg-black flex items-center justify-center p-4">AUTHENTICATING_IDENTITY...</div>;

  return (
    <main className="admin-layout animate-fade">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">ARUND_PRASAD</div>
        
        <nav className="admin-nav">
          <div className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Identity Overview
          </div>
          <div className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            Site Settings
          </div>
          <div className="admin-nav-item" onClick={() => router.push("/admin/journal")}>
            Mindset Log
          </div>
          <div className={`admin-nav-item ${activeTab === 'ventures' ? 'active' : ''}`} onClick={() => setActiveTab('ventures')}>
            Venture CMS
          </div>
        </nav>

        <button onClick={handleSignOut} className="admin-btn secondary mt-auto">
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <section className="admin-main">
        <header className="admin-header">
          <div>
            <h2>Site Control Panel</h2>
            <p className="text-sm text-neutral-500">Managing arundprasad.online</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold text-neutral-400 block uppercase">Identity Sync</span>
            <span className="text-xl font-bold">{syncProgress.toFixed(1)}%</span>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="admin-grid">
            <div className="admin-card col-span-2">
              <h3>5-Year Vision Progress</h3>
              <p className="text-sm text-neutral-400">Your transition to Technological Architect is {syncProgress.toFixed(2)}% synchronized.</p>
              <div className="vision-progress">
                <div className="vision-progress-fill" style={{ width: `${syncProgress}%` }}></div>
              </div>
            </div>

            <div className="admin-card">
              <h3>System Status</h3>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Database</span>
                  <span className="text-green-500">Connected</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Auth Session</span>
                  <span className="text-green-500">Active</span>
                </div>
              </div>
            </div>

            <div className="admin-card">
              <h3>Quick Observation</h3>
              <textarea placeholder="Dump a quick mindset shift..." className="form-textarea h-24 mb-4"></textarea>
              <button className="admin-btn">Log Observation</button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <form className="admin-card" onSubmit={handleSaveSettings}>
            <h3>Global Public View</h3>
            <div className="form-group">
              <label>Hero Bio Mantra</label>
              <textarea 
                className="form-textarea h-32" 
                value={settings.bio}
                onChange={(e) => setSettings({...settings, bio: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Cover Banner Image</label>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginTop: '-0.25rem', marginBottom: '0.75rem', textTransform: 'none' }}>
                Recommended resolution: 1920 x 450 pixels (Aspect ratio ~4:1)
              </span>
              <div className="cover-upload-zone">
                {settings.cover_url ? (
                  <div 
                    ref={previewRef}
                    className={`cover-preview-wrapper draggable ${isDragging ? 'dragging' : ''}`}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                  >
                    <img 
                      src={settings.cover_url} 
                      alt="Cover Preview" 
                      className="cover-preview-img" 
                      style={{ 
                        objectPosition: `center ${settings.cover_position_y ?? 50}%`,
                        userSelect: 'none',
                        WebkitUserSelect: 'none'
                      }}
                      draggable={false}
                    />
                    <div className="cover-drag-overlay">
                      <span>↕ Drag to Reposition Cover Banner</span>
                    </div>
                    <button type="button" className="btn-remove-cover" onClick={handleResetCover}>
                      Remove Cover
                    </button>
                  </div>
                ) : (
                  <div className="cover-placeholder">
                    <p className="text-sm text-neutral-400">Default Animated Metallic Banner Active</p>
                  </div>
                )}
                
                <div className="flex items-center gap-4 mt-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="cover-file-input"
                    className="hidden" 
                    onChange={handleCoverUpload}
                    disabled={isUploading}
                  />
                  <label htmlFor="cover-file-input" className="admin-btn secondary text-center cursor-pointer">
                    {isUploading ? "Uploading..." : "Upload Cover Image"}
                  </label>
                </div>
                {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label>Venture Count</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={settings.ventures_count}
                  onChange={(e) => setSettings({...settings, ventures_count: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="form-group">
                <label>Years of Exp</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={settings.experience_years}
                  onChange={(e) => setSettings({...settings, experience_years: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            <button type="submit" className="admin-btn" disabled={isSaving || isUploading}>
              {isSaving ? "Deploying..." : "Update Front View"}
            </button>
          </form>
        )}

        {activeTab === 'ventures' && (
          <div className="flex flex-col gap-8">
            {/* Create New Venture Form */}
            <form className="admin-card" onSubmit={async (e) => {
              e.preventDefault();
              setIsSaving(true);
              const target = e.target as any;
              const { error } = await supabase.from("ventures").insert({
                title: target.title.value,
                description: target.description.value,
                tags: target.tags.value.split(",").map((t: string) => t.trim()),
                link: target.link.value,
                display_order: 0
              });
              if (!error) {
                target.reset();
                fetchSettings(); // Refresh ventures list (shared fetch logic can be optimized later)
                alert("New Venture Pinned to your Front View.");
              }
              setIsSaving(false);
            }}>
              <h3>Pin New Venture</h3>
              <div className="form-group">
                <label>Venture Title</label>
                <input name="title" className="form-input" placeholder="e.g. LottoMate Ecosystem" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" className="form-textarea h-24" placeholder="Briefly explain the impact..." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label>Tech Tags (Comma separated)</label>
                  <input name="tags" className="form-input" placeholder="React, Node.js, Supabase" />
                </div>
                <div className="form-group">
                  <label>Project Link (Optional)</label>
                  <input name="link" className="form-input" placeholder="https://..." />
                </div>
              </div>
              <button type="submit" className="admin-btn" disabled={isSaving}>
                {isSaving ? "Pinning..." : "Pin to Home Page"}
              </button>
            </form>

            <div className="admin-card">
              <h3>Currently Pinned Milestones</h3>
              <p className="text-sm text-neutral-500 mb-8">Manage the visibility of your ventures.</p>
              <div className="flex flex-col gap-4">
                {/* List will be populated by a separate fetch if necessary, or shared state */}
                <div className="text-xs text-neutral-500 italic">Navigate to your public homepage to verify current layout. Management of existing entries coming in next update.</div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
