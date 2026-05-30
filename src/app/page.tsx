import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import "./hero.css";
import "./ventures.css";
import "./knowledge.css";

export default async function Home() {
  const supabase = await createClient();
  
  // Fetch Site Settings
  const { data: settings } = await supabase.from("site_settings").select("*").maybeSingle();
  
  // Fetch Ventures
  const { data: ventures } = await supabase
    .from("ventures")
    .select("*")
    .order("display_order", { ascending: true });

  // Fallback / Defaults
  const bio = settings?.bio || "Building the Next5. Stay Sharp 🧡";
  const ventureCount = settings?.ventures_count || 5;
  const experienceYears = settings?.experience_years || 10;
  const phone = settings?.phone || "071 332 0031";
  const email = settings?.email || "contact@arundprasad.online";

  return (
    <main className="min-h-screen pb-20">
      {/* Social Identity Hub Header */}
      <section className="profile-hub-container animate-fade">
        <div className="cover-banner">
          {settings?.cover_url ? (
            <Image 
              src={settings.cover_url} 
              alt="Cover Banner" 
              fill 
              sizes="100vw"
              style={{ 
                objectPosition: `center ${settings.cover_position_y ?? 50}%`,
                objectFit: 'cover'
              }}
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="next5-text">Next5</div>
          )}
        </div>
        
        <div className="profile-overlay-wrapper">
          <div className="profile-img-container">
            <div className="pulsing-ring"></div>
            <div 
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: '100%', 
                backgroundColor: '#171717', 
                borderRadius: '50%', 
                overflow: 'hidden' 
              }}
            >
              <Image 
                src="/profile.jpg" 
                alt="Arun D Prasad" 
                fill 
                sizes="180px"
                className="object-cover"
                priority
              />
            </div>
          </div>

          <div className="identity-content">
            <h1 className="profile-name">Arun D Prasad</h1>
            
            <div className="profile-stats">
              <span className="stat-item"><b>{ventureCount}</b> Ventures</span>
              <span className="stat-item"><b>1</b> Vision</span>
              <span className="stat-item"><b>{experienceYears}+</b> Years</span>
            </div>

            <div className="profile-description">
              <p className="mb-4">
                <b>Entrepreneur</b>
              </p>
              <div 
                className="whitespace-pre-line leading-relaxed text-neutral-300"
                dangerouslySetInnerHTML={{ __html: bio.replace(/\n/g, '<br/>') }}
              />
              
              <div className="flex flex-col gap-2 text-sm text-neutral-500 mt-6">
                <Link href="https://www.arundprasad.online" className="hover:text-accent transition-colors">
                  🔗 https://www.arundprasad.online
                </Link>
                <div className="flex gap-4">
                  <span>💼 Technological Architect</span>
                  <span>📞 {phone}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <Link href="#ventures" className="btn-primary">View Milestones</Link>
              <Link href={`mailto:${email}`} className="btn-secondary">Message</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Ventures Section (Pinned Milestones) */}
      <section id="ventures" className="section-container">
        <div className="flex items-center gap-4 mb-10">
          <div className="h-px bg-neutral-800 flex-1"></div>
          <h2 className="text-sm font-bold tracking-widest uppercase text-neutral-500">Pinned Milestones</h2>
          <div className="h-px bg-neutral-800 flex-1"></div>
        </div>

        <div className="ventures-grid">
          {ventures && ventures.length > 0 ? (
            ventures.map((v) => (
              <div key={v.id} className="venture-card glass">
                <div className="tag-container">
                  {v.tags?.map((tag: string) => (
                    <span key={tag} className="tech-tag">{tag}</span>
                  ))}
                </div>
                <h3>{v.title}</h3>
                <p>{v.description}</p>
                {v.link && (
                  <Link href={v.link} className="text-xs text-accent mt-4 inline-block hover:underline">
                    View Project →
                  </Link>
                )}
              </div>
            ))
          ) : (
            <>
              {/* Default Placeholders if no ventures in DB yet */}
              <div className="venture-card glass opacity-50">
                <h3>Venture Placeholder</h3>
                <p>Add your first venture in the Site Control Panel to replace this.</p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
