import { useEffect, useMemo, useRef, useState } from "react";

// Tell TS about our helper from index.html
declare global {
  interface Window {
    proxyURL?: (url: string) => string;
  }
}

type Media = {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  media_type?: "movie" | "tv";
};

type Genre = { id: number; name: string };
type Playlist = { id: string; name: string; items: Media[] };

const TMDB_KEY = "1070730380f5fee0d87cf0382670b255";
const IMG = (p: string | null, s = "w500") => p ? `https://image.tmdb.org/t/p/${s}${p}` : "";
const IMG_ORIG = (p: string | null) => p ? `https://image.tmdb.org/t/p/original${p}` : "";

const SERVERS = [
  { id: "vidlux1", name: "VidLux", build: (id: number, type: string, s?: number, e?: number) => type === "tv" ? `https://vidlux.xyz/embed/tv/${id}/${s||1}/${e||1}` : `https://vidlux.xyz/embed/movie/${id}` },
  { id: "vidlux2", name: "Lux Top", build: (id: number, type: string, s?: number, e?: number) => type === "tv" ? `https://vidlux.top/embed/tv/${id}/${s||1}/${e||1}` : `https://vidlux.top/embed/movie/${id}` },
  { id: "vidlux3", name: "Lux Site", build: (id: number, type: string, s?: number, e?: number) => type === "tv" ? `https://vidlux.site/embed/tv/${id}/${s||1}/${e||1}` : `https://vidlux.site/embed/movie/${id}` },
  { id: "vidlux4", name: "Lux Online", build: (id: number, type: string, s?: number, e?: number) => type === "tv" ? `https://vidlux.online/embed/tv/${id}/${s||1}/${e||1}` : `https://vidlux.online/embed/movie/${id}` },
  { id: "vixsrc", name: "VixSrc", build: (id: number, type: string) => `https://vixsrc.to/${type}/${id}` },
  { id: "vidstorm", name: "VidStorm", build: (id: number, type: string) => `https://vidstorm.ru/${type}/${id}` },
  { id: "vidsrc", name: "VidSrc", build: (id: number, type: string) => `https://vidsrc-embed.ru/embed/${type}/${id}?autoplay=1` },
  { id: "vidplus", name: "VidPlus", build: (id: number, type: string) => `https://player.vidplus.to/embed/${type}/${id}` },
  { id: "vidrock", name: "VidRock", build: (id: number, type: string) => `https://vidrock.net/${type}/${id}` },
  { id: "rivestream", name: "Rive", build: (id: number, type: string) => `https://rivestream.org/embed?type=${type}&id=${id}` },
  { id: "vidbinge", name: "VidBinge", build: (id: number, type: string, s?: number, e?: number) => type === "tv" ? `https://vidbinge.to/tv/${id}/${s||1}/${e||1}` : `https://vidbinge.to/movie/${id}` },
];

function useLocal<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "") as T } catch { return initial }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(v)) }, [key, v]);
  return [v, setV] as const;
}

async function tmdb(path: string) {
  const res = await fetch(`https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_KEY}&language=en-US`);
  if (!res.ok) throw new Error("TMDB");
  return res.json();
}

function cn(...c: (string|false|undefined)[]) { return c.filter(Boolean).join(" ") }

export default function App() {
  const [tab, setTab] = useState<"home"|"anime"|"explore"|"continue"|"playlists"|"settings">("home");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [trending, setTrending] = useState<Media[]>([]);
  const [popular, setPopular] = useState<Media[]>([]);
  const [top, setTop] = useState<Media[]>([]);
  const [animeMovies, setAnimeMovies] = useState<Media[]>([]);
  const [animeTV, setAnimeTV] = useState<Media[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Media[]>([]);
  const [activeGenre, setActiveGenre] = useState<number|null>(null);
  
  const [continueList, setContinueList] = useLocal<(Media & {last:number})[]>("crystal.continue", []);
  const [playlists, setPlaylists] = useLocal<Playlist[]>("crystal.playlists", []);
  const [user, setUser] = useLocal<{u:string,p:string}|null>("crystal.user", null);
  
  const [settings, setSettings] = useLocal("crystal.settings.v5", {
    adblock: 3 as 0|1|2|3,
    theme: "violet" as "violet"|"blue"|"emerald"|"rose"|"amber",
    sandbox: true,
    background: "aurora" as "default"|"grid"|"dots"|"aurora"|"reactive",
  });
  
  const [player, setPlayer] = useState<Media|null>(null);
  const [serverIdx, setServerIdx] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showNovaTip, setShowNovaTip] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [showPlayerUI, setShowPlayerUI] = useState(true);
  
  const searchRef = useRef<HTMLInputElement>(null);
  const mousePos = useRef({x:0,y:0});
  const playerIdleRef = useRef<number>(0);

  // Show Nova tip
  useEffect(() => {
    const seen = localStorage.getItem("nova.tip");
    if (!seen) {
      setTimeout(() => setShowNovaTip(true), 1500);
    }
  }, []);

  // Load data
  useEffect(() => {
    tmdb("/genre/movie/list").then(d => setGenres(d.genres||[])).catch(()=>{});
    tmdb("/trending/all/week").then(d => setTrending((d.results||[]).slice(0,14))).catch(()=>{});
    tmdb("/movie/popular").then(d => setPopular(d.results||[].slice(0,18))).catch(()=>{});
    tmdb("/movie/top_rated").then(d => setTop(d.results||[].slice(0,18))).catch(()=>{});
    tmdb("/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc").then(d => setAnimeMovies(d.results||[].slice(0,18))).catch(()=>{});
    tmdb("/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc").then(d => setAnimeTV(d.results||[].slice(0,18))).catch(()=>{});
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!search && !activeGenre) { setResults([]); return }
      const q = search ? `/search/multi?query=${encodeURIComponent(search)}` : `/discover/movie?sort_by=popularity.desc${activeGenre?`&with_genres=${activeGenre}`:""}`;
      const d = await tmdb(q).catch(()=>({results:[]}));
      setResults((d.results||[]).filter((m:any)=>!m.media_type || m.media_type!=="person"));
    };
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [search, activeGenre]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { mousePos.current = {x:e.clientX, y:e.clientY} };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Player UI auto-hide
  useEffect(() => {
    if (!player) return;
    const reset = () => {
      setShowPlayerUI(true);
      window.clearTimeout(playerIdleRef.current);
      playerIdleRef.current = window.setTimeout(() => setShowPlayerUI(false), 3000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    return () => {
      window.removeEventListener("mousemove", reset);
      window.clearTimeout(playerIdleRef.current);
    };
  }, [player]);

  const featured = useMemo(() => trending[0], [trending]);

  const openPlayer = async (m: Media) => {
    const media = {...m, media_type: m.media_type || (m.first_air_date ? "tv" : "movie")};
    setPlayer(media as Media);
    setServerIdx(0);
    setShowInfo(false);
    setShowEpisodes(false);
    setSeason(1);
    setEpisode(1);
    setContinueList(prev => [{...media, last: Date.now()}, ...prev.filter(p=>p.id!==m.id)].slice(0,24));
    
    if (media.media_type === "tv") {
      try {
        const data = await tmdb(`/${media.media_type}/${media.id}`);
        setSeasons(Array.from({length: data.number_of_seasons || 1}, (_,i)=>i+1));
      } catch { setSeasons([1]) }
    }
  };

  const themeColors: Record<string, string> = {
    violet: "from-violet-600 to-fuchsia-600",
    blue: "from-blue-600 to-cyan-600",
    emerald: "from-emerald-600 to-teal-600",
    rose: "from-rose-600 to-pink-600",
    amber: "from-amber-600 to-orange-600",
  };

  return (
    <div className={cn("min-h-screen bg-[#030307] text-zinc-100 selection:bg-violet-500/30", `theme-${settings.theme}`)} data-theme={settings.theme}>
      <style>{`
        @keyframes kenburns { 0% { transform: scale(1) translate(0,0) } 100% { transform: scale(1.12) translate(-1.5%,1%) } }
        @keyframes float { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-15px) rotate(1deg) } }
        @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 20px -5px currentColor, inset 0 1px 0 rgba(255,255,255,0.15) } 50% { box-shadow: 0 0 40px -3px currentColor, inset 0 1px 0 rgba(255,255,255,0.2) } }
        @keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }
        .scrollbar-hide::-webkit-scrollbar { display: none }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none }
        @media (max-width: 640px) {
          * { -webkit-tap-highlight-color: transparent; }
          html { overscroll-behavior: none; }
          body { overscroll-behavior: none; position: fixed; overflow: hidden; width: 100%; height: 100%; }
          #root { width: 100%; height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
        }
        .safe-top { padding-top: env(safe-area-inset-top); }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        .h-dvh { height: 100dvh; }
      `}</style>
      
      {/* Dynamic Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#030307]" />
        {settings.background === "aurora" && (
          <>
            <div className="absolute inset-0 opacity-40" style={{background:`radial-gradient(600px at 20% 20%, rgba(124,58,237,0.15), transparent 60%), radial-gradient(500px at 80% 30%, rgba(236,72,153,0.12), transparent 60%), radial-gradient(700px at 50% 80%, rgba(14,165,233,0.1), transparent 60%)`}} />
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 animate-[float_20s_ease-in-out_infinite]" style={{background:`linear-gradient(135deg, #8b5cf6, #ec4899)`}} />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-15 animate-[float_25s_ease-in-out_infinite_reverse]" style={{background:`linear-gradient(135deg, #06b6d4, #8b5cf6)`}} />
          </>
        )}
        {settings.background === "grid" && <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:64px_64px]" />}
        {settings.background === "dots" && <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(white_1.5px,transparent_1.5px)] [background-size:32px_32px]" />}
        {settings.background === "reactive" && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute w-[900px] h-[900px] rounded-full blur-[140px] opacity-[0.15] transition-transform duration-700 ease-out" style={{background:`radial-gradient(circle, ${settings.theme==='violet'?'#8b5cf6':settings.theme==='blue'?'#3b82f6':settings.theme==='emerald'?'#10b981':settings.theme==='rose'?'#f43f5e':'#f59e0b'}, transparent 70%)`, left: mousePos.current.x-450, top: mousePos.current.y-450, transform:`translate3d(0,0,0)`}} />
            <div className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-[0.1] transition-transform duration-1000 ease-out" style={{background:`radial-gradient(circle, #ec4899, transparent 70%)`, left: mousePos.current.x-300, top: mousePos.current.y-300}} />
          </div>
        )}
      </div>

      {/* Nova Tip */}
      {showNovaTip && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-3 rounded-[20px] border border-blue-500/40 bg-blue-950/90 px-5 py-3.5 backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.8)]">
            <div className="size-9 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 grid place-items-center animate-[pulse-glow_2s_ease-in-out_infinite] shadow-lg shadow-blue-500/50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-blue-200 uppercase">Spider Pro Tip</div>
              <div className="text-sm text-white font-medium">Use <b className="text-cyan-300">Nova</b> on the blue thing that says spider</div>
            </div>
            <button onClick={()=>{setShowNovaTip(false); localStorage.setItem("nova.tip","1")}} className="ml-1 size-7 grid place-items-center rounded-xl hover:bg-white/10 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl border-b border-white/[0.06] bg-black/80 supports-[backdrop-filter]:bg-black/60">
        <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8 h-[60px] sm:h-[68px] flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className={cn("size-9 sm:size-10 rounded-xl sm:rounded-2xl bg-gradient-to-br grid place-items-center shadow-[0_0_40px_-12px] transition-transform active:scale-95", themeColors[settings.theme])} style={{boxShadow:`0 0 40px -12px ${settings.theme==='violet'?'#a78bfa':settings.theme==='blue'?'#60a5fa':settings.theme==='emerald'?'#10b981':settings.theme==='rose'?'#ec4899':'#f59e0b'}`}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="sm:w-[22px] sm:h-[22px]">
                <path d="M12 2 L17.5 7 L15.5 16 H8.5 L6.5 7 Z" fill="white" fillOpacity="0.95"/>
                <path d="M12 2 L8.5 7 M12 2 L15.5 7 M12 2 L6.5 7 M12 2 L17.5 7" stroke="white" strokeOpacity="0.6" strokeWidth="1"/>
                <path d="M8.5 7 H15.5 L14 12 H10 Z" fill="white" fillOpacity="0.3"/>
                <path d="M10 12 L12 19 L14 12" stroke="white" strokeOpacity="0.5" strokeWidth="1.2"/>
              </svg>
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-bold tracking-wide text-[15px]">CRYSTAL</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 -mt-0.5 font-medium">VIDLUX • CRYSTAL</div>
            </div>
          </div>
          
          <nav className="min-w-0 flex-1 ml-2 sm:ml-6 flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide">
            {([
              ["home","Home"],
              ["anime","Anime"],
              ["explore","Explore"],
              ["continue","History"],
              ["playlists","Lists"],
              ["settings","Config"],
            ] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} className={cn("relative h-8 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[12.5px] sm:text-[13.5px] whitespace-nowrap transition-all duration-300 shrink-0 active:scale-95", tab===k?"text-white":"text-zinc-400 hover:text-zinc-200")}>
                {tab===k && <div className={cn("absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r opacity-25", themeColors[settings.theme])} />}
                {tab===k && <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-white/[0.12] backdrop-blur border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]" />}
                <span className="relative font-medium">{l}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={()=>searchRef.current?.focus()} className="size-8 grid place-items-center rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition active:scale-95 md:hidden">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </button>
            <div className="relative hidden md:block group">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 group-focus-within:opacity-100 transition pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search movies..." className="h-9 w-[180px] lg:w-[240px] xl:w-[300px] rounded-xl bg-white/[0.04] border border-white/10 pl-9 pr-3 text-sm outline-none focus:bg-white/[0.08] focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all placeholder-zinc-600" />
            </div>
            {user ? (
              <div className="size-8 sm:size-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 grid place-items-center text-[13px] sm:text-sm font-bold shadow-lg shadow-violet-900/30 ring-1 ring-white/15 hover:scale-105 transition-all cursor-pointer active:scale-95" onClick={()=>setTab("settings")}>{user.u[0].toUpperCase()}</div>
            ) : (
              <button onClick={()=>setTab("settings")} className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[12.5px] sm:text-sm transition font-medium hover:border-white/20 active:scale-95">Sign in</button>
            )}
          </div>
        </div>
        {/* Mobile search bar */}
        {search && (
          <div className="md:hidden border-t border-white/5 px-3 py-2.5 bg-black/50 backdrop-blur-xl">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." autoFocus className="h-9 w-full rounded-xl bg-white/5 border border-white/10 pl-8 pr-8 text-sm outline-none focus:bg-white/10 focus:border-violet-500/50" />
              <button onClick={()=>setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 grid place-items-center rounded-full hover:bg-white/10"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1800px] px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        <div key={tab} className="animate-in fade-in-0 zoom-in-95 duration-500">
        {tab === "home" && (
          <div className="space-y-8 sm:space-y-10">
            {featured && (
              <div className="relative overflow-hidden rounded-[24px] sm:rounded-[32px] border border-white/[0.08] bg-black shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0">
                  <img src={IMG_ORIG(featured.backdrop_path)} className="h-full w-full object-cover animate-[kenburns_25s_ease-in-out_infinite_alternate]" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent sm:via-transparent" />
                  <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`}} />
                </div>
                <div className="relative z-10 p-5 sm:p-8 md:p-12 lg:p-16 min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] flex items-end">
                  <div className="max-w-3xl w-full">
                    <div className="inline-flex items-center gap-2 sm:gap-2.5 rounded-full bg-white/[0.08] px-3 py-1.5 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs backdrop-blur-2xl border border-white/10 mb-3 sm:mb-4 shadow-[0_0_40px_rgba(0,0,0,0.6)]">
                      <span className="size-1.5 sm:size-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px] shadow-emerald-400/80" />
                      <span className="font-semibold tracking-wider uppercase">Trending Now</span>
                      <span className="text-zinc-500 hidden sm:inline">•</span>
                      <span className="hidden sm:inline">★ {featured.vote_average.toFixed(1)}</span>
                    </div>
                    <h1 className="text-[clamp(24px,7vw,56px)] font-black tracking-[-0.02em] leading-[0.95] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">{featured.title || featured.name}</h1>
                    <p className="mt-3 sm:mt-4 text-[14px] sm:text-[15px] leading-relaxed text-zinc-200/90 line-clamp-2 sm:line-clamp-3 max-w-2xl drop-shadow-lg">{featured.overview}</p>
                    <div className="mt-5 sm:mt-7 flex flex-wrap gap-2.5 sm:gap-3">
                      <button onClick={()=>openPlayer(featured)} className={cn("group relative h-11 sm:h-12 px-5 sm:px-7 rounded-xl sm:rounded-2xl font-bold text-black overflow-hidden transition-all hover:scale-[1.03] active:scale-[0.97] shadow-[0_8px_24px_rgba(0,0,0,0.4)]", `bg-gradient-to-r ${themeColors[settings.theme]} hover:shadow-[0_8px_32px_rgba(139,92,246,0.4)]`)}>
                        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors" />
                        <span className="relative flex items-center gap-1.5 sm:gap-2 text-[14px] sm:text-[15px]"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow"><path d="M8 5.14v14l11-7-11-7z"/></svg>Play</span>
                      </button>
                      <button onClick={()=>{setSearch(featured.title||featured.name||""); setTab("explore")}} className="h-11 sm:h-12 px-5 sm:px-6 rounded-xl sm:rounded-2xl bg-white/[0.08] hover:bg-white/15 border border-white/15 backdrop-blur-2xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.97] text-[14px] sm:text-[15px] shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                        <span className="flex items-center gap-1.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span className="hidden sm:inline">Details</span><span className="sm:hidden">Info</span></span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full blur-[120px] opacity-25 pointer-events-none" style={{background:`radial-gradient(circle, #8b5cf6, #ec4899, transparent 70%)`}} />
              </div>
            )}

            <Section title="Continue Watching" items={continueList} onOpen={openPlayer} />
            <Section title="Popular Right Now" items={popular} onOpen={openPlayer} />
            <Section title="Top Rated" items={top} onOpen={openPlayer} />
          </div>
        )}

        {tab === "anime" && (
          <div className="space-y-8 sm:space-y-10">
            <div>
              <h2 className="text-[19px] sm:text-[22px] font-bold mb-4 sm:mb-5 flex items-center gap-2.5 sm:gap-3"><div className="size-7 sm:size-8 rounded-xl bg-gradient-to-br from-pink-600 to-rose-600 grid place-items-center shadow-lg shadow-pink-900/20 ring-1 ring-white/10"><span className="text-xs sm:text-sm font-bold">映</span></div>Anime Movies</h2>
              <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-4 lg:gap-5">
                {animeMovies.map(m=> <Card key={m.id} m={m} onClick={()=>openPlayer({...m, media_type:"movie"})} />)}
              </div>
            </div>
            <div>
              <h2 className="text-[19px] sm:text-[22px] font-bold mb-4 sm:mb-5 flex items-center gap-2.5 sm:gap-3"><div className="size-7 sm:size-8 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 grid place-items-center shadow-lg shadow-cyan-900/20 ring-1 ring-white/10"><span className="text-xs font-bold">TV</span></div>Anime Series</h2>
              <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-4 lg:gap-5">
                {animeTV.map(m=> <Card key={m.id} m={m} onClick={()=>openPlayer({...m, media_type:"tv"})} />)}
              </div>
            </div>
          </div>
        )}

        {tab === "explore" && (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1">
              <button onClick={()=>setActiveGenre(null)} className={cn("h-8 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-xl border text-[12px] sm:text-sm font-medium transition whitespace-nowrap shrink-0 active:scale-95", !activeGenre?"bg-white text-black border-white shadow-sm":"border-white/10 hover:bg-white/5 hover:border-white/20 bg-white/[0.02] backdrop-blur")}>All</button>
              {genres.slice(0,16).map(g=>(
                <button key={g.id} onClick={()=>setActiveGenre(g.id)} className={cn("h-8 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-xl border text-[12px] sm:text-sm transition whitespace-nowrap shrink-0 active:scale-95", activeGenre===g.id?"bg-white text-black border-white shadow-sm":"border-white/10 hover:bg-white/5 text-zinc-300 bg-white/[0.02] backdrop-blur")}>{g.name}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-4 lg:gap-5">
              {(results.length?results:popular).map(m=> <Card key={m.id} m={m} onClick={()=>openPlayer(m)} />)}
            </div>
          </div>
        )}

        {tab === "continue" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Continue Watching</h2>
            {continueList.length===0 ? <div className="rounded-[24px] border border-dashed border-white/10 p-16 text-center"><div className="text-5xl mb-3 opacity-20">🎬</div><div className="text-zinc-500">No history yet. Start watching something!</div></div> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5">
                {continueList.map(m=> <Card key={m.id} m={m} onClick={()=>openPlayer(m)} />)}
              </div>
            )}
          </div>
        )}

        {tab === "playlists" && (
          <div className="max-w-5xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">My Playlists</h2>
              <button onClick={()=>{
                const name = prompt("Playlist name:");
                if(name) setPlaylists(p=>[...p, {id:Math.random().toString(36).slice(2), name, items:[]}]);
              }} className={cn("h-10 px-5 rounded-xl font-medium text-black shadow-lg transition hover:scale-105", `bg-gradient-to-r ${themeColors[settings.theme]}`)}>+ New Playlist</button>
            </div>
            {playlists.length===0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 p-16 text-center text-zinc-500">Create your first playlist to save favorites</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                {playlists.map(pl=>(
                  <div key={pl.id} className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 backdrop-blur hover:border-white/20 transition">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-violet-600/10 to-transparent" />
                    <div className="relative flex items-center justify-between mb-4">
                      <div className="font-semibold text-lg">{pl.name} <span className="text-zinc-500 text-sm font-normal">• {pl.items.length}</span></div>
                      <button onClick={()=>setPlaylists(p=>p.filter(x=>x.id!==pl.id))} className="text-xs text-zinc-500 hover:text-red-400 transition">Delete</button>
                    </div>
                    <div className="relative grid grid-cols-4 gap-2.5">
                      {pl.items.slice(0,8).map(it=> <img key={it.id} src={IMG(it.poster_path)} className="aspect-[2/3] rounded-xl object-cover bg-zinc-900 ring-1 ring-white/5" alt="" />)}
                      {Array.from({length: Math.max(0, 4 - pl.items.length)}).map((_,i)=><div key={i} className="aspect-[2/3] rounded-xl bg-zinc-900/50 ring-1 ring-white/5" />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="max-w-3xl space-y-6">
            <h2 className="text-[28px] font-bold">Configuration</h2>
            
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><div className="size-7 rounded-lg bg-white/10 grid place-items-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div> Account</h3>
              {user ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 grid place-items-center font-bold shadow-lg shadow-violet-900/20">{user.u[0].toUpperCase()}</div>
                    <div><div className="font-medium">{user.u}</div><div className="text-xs text-emerald-400">Sync enabled • {continueList.length} items</div></div>
                  </div>
                  <button onClick={()=>setUser(null)} className="text-sm px-4 h-9 rounded-xl border border-white/10 hover:bg-white/5 transition">Logout</button>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <input id="lu" placeholder="Username" className="flex-1 h-11 rounded-xl bg-black/50 border border-white/10 px-3.5 outline-none focus:border-violet-500/50 transition" />
                  <input id="lp" type="password" placeholder="Password" className="flex-1 h-11 rounded-xl bg-black/50 border border-white/10 px-3.5 outline-none focus:border-violet-500/50 transition" />
                  <button onClick={()=>{
                    const u=(document.getElementById("lu") as HTMLInputElement).value;
                    const p=(document.getElementById("lp") as HTMLInputElement).value;
                    if(u&&p) setUser({u,p});
                  }} className={cn("h-11 px-5 rounded-xl font-medium text-black transition hover:scale-105", `bg-gradient-to-r ${themeColors[settings.theme]}`)}>Login</button>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur space-y-5">
              <h3 className="font-semibold flex items-center gap-2"><div className="size-7 rounded-lg bg-white/10 grid place-items-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div> Player & Security</h3>
              <div>
                <div className="flex items-center justify-between mb-2.5"><span className="text-sm">Adblock</span><span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", settings.adblock===3?"bg-emerald-500/20 text-emerald-300 border border-emerald-500/30":settings.adblock===0?"bg-zinc-700/50 text-zinc-400":"bg-amber-500/20 text-amber-300 border border-amber-500/30")}>{["Off","Medium","High","Ultra"][settings.adblock]}</span></div>
                <input type="range" min="0" max="3" value={settings.adblock} onChange={e=>setSettings(s=>({...s,adblock:parseInt(e.target.value) as any}))} className="w-full h-2 accent-violet-500 cursor-pointer" />
              </div>
              <label className="flex items-center justify-between py-3 border-t border-white/5 cursor-pointer group">
                <div><div className="text-sm font-medium group-hover:text-white transition">Enable Sandbox</div><div className="text-xs text-zinc-500">Isolates player for security</div></div>
                <input type="checkbox" checked={settings.sandbox} onChange={e=>setSettings(s=>({...s,sandbox:e.target.checked}))} className="size-5 accent-violet-500 cursor-pointer" />
              </label>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur space-y-5">
              <h3 className="font-semibold flex items-center gap-2"><div className="size-7 rounded-lg bg-white/10 grid place-items-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/></svg></div> Appearance</h3>
              <div>
                <div className="text-sm mb-3">Theme Color</div>
                <div className="flex gap-2.5">
                  {(["violet","blue","emerald","rose","amber"] as const).map(t=>(
                    <button key={t} onClick={()=>setSettings(s=>({...s,theme:t}))} className={cn("group relative size-11 rounded-2xl bg-gradient-to-br transition-all hover:scale-110", themeColors[t], settings.theme===t?"ring-2 ring-white ring-offset-2 ring-offset-black scale-110":"")}>
                      {settings.theme===t && <div className="absolute inset-0 grid place-items-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg></div>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm mb-3">Background Effect</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(["default","aurora","grid","dots","reactive"] as const).map(b=>(
                    <button key={b} onClick={()=>setSettings(s=>({...s,background:b}))} className={cn("h-10 rounded-xl border text-[13px] capitalize font-medium transition", settings.background===b?"bg-white text-black border-white":"border-white/10 hover:bg-white/5 hover:border-white/20")}>{b}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-emerald-500/20 bg-gradient-to-b from-emerald-950/30 to-emerald-950/10 p-6 backdrop-blur">
              <h3 className="font-semibold mb-4 flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 grid place-items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
                <span>Legal & How Crystal Works</span>
              </h3>
              <div className="space-y-3.5 text-[13.5px] leading-relaxed">
                <p className="text-zinc-200"><strong className="text-white font-semibold">Crystal is 100% legal.</strong> We are a metadata search engine, not a video host. All movie data (posters, synopsis, ratings) comes from TheMovieDB.org API. When you press play, Crystal loads the video from independent third-party embed sites like VidLux, VixSrc, and Rivestream — the same embeds available publicly on Google.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2">
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5">
                    <div className="text-emerald-400 text-xs font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"/>Legal</div>
                    <div className="text-[12px] text-zinc-400">No files stored. DMCA safe harbor. Indexing only. Same as search engines.</div>
                  </div>
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5">
                    <div className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-1.5">Privacy</div>
                    <div className="text-[12px] text-zinc-400">100% client-side. Your history stays in your browser only. No tracking.</div>
                  </div>
                  <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5">
                    <div className="text-violet-400 text-xs font-bold uppercase tracking-wide mb-1.5">Open</div>
                    <div className="text-[12px] text-zinc-400">Uses public embeds. We block ads & popups for safety only.</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 text-[12px] text-zinc-500">
                  <p>✓ We DO: Index TMDB • Link to public embeds • Block malicious ads • Run entirely in your browser</p>
                  <p className="mt-1.5">✗ We DON'T: Host videos • Upload content • Bypass DRM • Store your data on servers</p>
                  <p className="mt-2.5">Rights holders: Contact the original embed host (VidLux, etc.) for takedowns. Crystal complies with DMCA for metadata.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Legal Footer */}
        <div className="mt-16 pt-8 border-t border-white/5">
          <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 grid place-items-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <span><strong className="text-zinc-300 font-medium">Crystal</strong> is a legal indexer. We don't host videos — all streams are from third-party public embeds.</span>
            </div>
            <button onClick={()=>setTab("settings")} className="hover:text-zinc-300 transition underline decoration-zinc-700 underline-offset-2">Legal Info & DMCA</button>
          </div>
        </div>
        </div>
      </main>

      {/* Immersive Player */}
      {player && (
        <div className="fixed inset-0 z-[100] bg-black overscroll-none touch-none">
          {/* Ambient glow - dynamic */}
          <div className="absolute inset-0 opacity-[0.18] blur-[100px] scale-125 pointer-events-none">
            <img src={IMG_ORIG(player.backdrop_path)} className="w-full h-full object-cover animate-[kenburns_30s_ease-in-out_infinite_alternate]" alt="" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_black_80%)] pointer-events-none" />
          
          <div className="relative h-full flex flex-col h-dvh">
            {/* Top controls - auto hide for immersion */}
            <div className={cn("relative z-30 border-b border-white/[0.08] bg-black/80 backdrop-blur-2xl transition-all duration-700", showPlayerUI ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none")}>
              <div className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 h-[48px] sm:h-[52px] safe-top">
                <button onClick={()=>setPlayer(null)} className="size-9 sm:size-9 grid place-items-center rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 transition hover:scale-105 active:scale-95 shrink-0 backdrop-blur-xl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] sm:text-[14px] font-semibold leading-tight">{player.title || player.name}</div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5"><span className="size-1 rounded-full bg-emerald-500 animate-pulse"/>{player.media_type==="tv"?`S${season} E${episode}`:"Movie"} • <span className="text-zinc-300">{SERVERS[serverIdx].name}</span></div>
                </div>
                
                <button onClick={()=>setShowInfo(!showInfo)} className={cn("h-8 sm:h-[34px] px-2.5 sm:px-3 rounded-xl text-[12px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-1.5 transition-all hover:scale-105 active:scale-95 shrink-0 border backdrop-blur-xl", showInfo?"bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]":"bg-white/10 hover:bg-white/15 border-white/15 text-white")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  <span className="hidden sm:inline">Info</span>
                </button>
                
                {player.media_type === "tv" && (
                  <button onClick={()=>setShowEpisodes(!showEpisodes)} className={cn("h-8 sm:h-[34px] px-2.5 sm:px-3 rounded-xl text-[12px] sm:text-[13px] font-medium flex items-center gap-1 sm:gap-1.5 transition-all hover:scale-105 active:scale-95 shrink-0 border backdrop-blur-xl", showEpisodes?"bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]":"bg-white/10 hover:bg-white/15 border-white/15 text-white")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>
                    <span className="hidden sm:inline">Episodes</span>
                  </button>
                )}
              </div>
            </div>
            
            {/* SERVER LIST - ALWAYS VISIBLE & IMMERSIVE */}
            <div className="relative z-20 border-b border-white/[0.08] bg-gradient-to-b from-black/95 to-black/85 backdrop-blur-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)]">
              <div className="relative px-2.5 sm:px-3 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px] shadow-emerald-500" />
                      STREAM
                    </div>
                    <div className="sm:hidden size-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 grid place-items-center">
                      <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
                    {SERVERS.map((s,i)=>(
                      <button key={s.id} onClick={()=>setServerIdx(i)} className={cn("group relative h-8 sm:h-[32px] px-3 sm:px-3.5 rounded-full text-[12px] sm:text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 border backdrop-blur-xl active:scale-95", i===serverIdx?"text-white border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-105":"text-zinc-300 border-white/10 hover:text-white hover:border-white/25 hover:bg-white/5")}>
                        {i===serverIdx && (
                          <>
                            <div className="absolute inset-0 rounded-full bg-blue-600/90 animate-[pulse-glow_2s_ease-in-out_infinite]" />
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500" />
                            <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
                          </>
                        )}
                        <span className="relative flex items-center gap-1.5">
                          {i===0 && <span className="size-1 rounded-full bg-white animate-pulse shadow-[0_0_4px_white]" />}
                          <span className="tracking-wide">{s.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  
                  <button onClick={()=>setServerIdx((serverIdx+1)%SERVERS.length)} className="size-8 shrink-0 grid place-items-center rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 hover:border-white/20 transition hover:rotate-180 active:rotate-180 active:scale-90 duration-500 backdrop-blur-xl group">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-70 group-hover:opacity-100 transition"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8V3h-5l2.26 2.26A7 7 0 1 0 21 12z"/></svg>
                  </button>
                </div>
              </div>
              {/* Subtle bottom glow */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
            </div>

            <div className="flex-1 relative bg-black overflow-hidden">
              <PlayerFrame 
                media={player} 
                server={SERVERS[serverIdx]} 
                adblock={settings.adblock}
                sandbox={settings.sandbox}
                season={season}
                episode={episode}
              />

              {/* Info Panel - responsive */}
              {showInfo && (
                <>
                  <div className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={()=>setShowInfo(false)} />
                  <div className={cn("fixed md:absolute z-50 bg-zinc-950/95 md:bg-zinc-950/90 backdrop-blur-2xl border border-white/15 shadow-[0_0_80px_rgba(0,0,0,0.9)] transition-all duration-500 max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-[28px] max-md:max-h-[85vh] max-md:overflow-hidden md:top-4 md:right-4 md:w-[340px] md:max-h-[85vh] md:rounded-[24px] md:overflow-auto", showPlayerUI?"max-md:translate-y-0 md:translate-x-0 opacity-100":"max-md:translate-y-full md:translate-x-4 opacity-0 pointer-events-none", showInfo?"":"hidden")}>
                    {/* Mobile handle */}
                    <div className="md:hidden flex justify-center pt-3 pb-2">
                      <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>
                    <div className="p-5 max-md:pb-8 max-md:overflow-auto max-md:max-h-[calc(85vh-24px)]">
                      <div className="flex gap-4">
                        <div className="relative shrink-0">
                          <img src={IMG(player.poster_path, "w300")} className="w-24 h-36 sm:w-28 sm:h-42 object-cover rounded-2xl bg-zinc-900 ring-1 ring-white/15 shadow-2xl" alt="" />
                          <div className="absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] pointer-events-none" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold leading-snug text-[15px]">{player.title || player.name}</div>
                          <div className="flex items-center flex-wrap gap-1.5 mt-2">
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/25 font-medium flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>{player.vote_average.toFixed(1)}</span>
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400">{(player.release_date || player.first_air_date || "").slice(0,4)}</span>
                            <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 uppercase">{player.media_type}</span>
                          </div>
                          <button onClick={()=>{
                            const name = prompt("Add to playlist:", playlists[0]?.name || "Favorites");
                            if(name) {
                              const pl = playlists.find(p=>p.name===name) || playlists[0];
                              if(pl) setPlaylists(ps=>ps.map(p=>p.id===pl.id?{...p, items:[player, ...p.items.filter(i=>i.id!==player.id)]}:p));
                              else setPlaylists(ps=>[...ps, {id:Math.random().toString(36).slice(2), name, items:[player]}]);
                              setShowInfo(false);
                            }
                          }} className="mt-3 h-8 w-full px-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] border border-white/10 hover:border-white/20 backdrop-blur">+ Add to Playlist</button>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 mb-2">Overview</div>
                        <p className="text-[13px] leading-relaxed text-zinc-300">{player.overview}</p>
                      </div>
                      <button onClick={()=>setShowInfo(false)} className="md:hidden mt-4 w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-medium text-sm active:scale-[0.98] transition">Close</button>
                    </div>
                  </div>
                </>
              )}

              {/* Episodes - responsive */}
              {showEpisodes && player.media_type==="tv" && (
                <>
                  <div className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" onClick={()=>setShowEpisodes(false)} />
                  <div className={cn("fixed md:absolute z-50 bg-zinc-950/95 md:bg-zinc-950/90 backdrop-blur-2xl border border-white/15 shadow-[0_0_80px_rgba(0,0,0,0.9)] transition-all duration-500 max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:rounded-t-[28px] max-md:max-h-[75vh] md:top-4 md:left-4 md:w-[320px] md:rounded-[24px]", showPlayerUI?"max-md:translate-y-0 md:translate-x-0 opacity-100":"max-md:translate-y-full md:-translate-x-4 opacity-0 pointer-events-none")}>
                    <div className="md:hidden flex justify-center pt-3 pb-1">
                      <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="font-bold mb-3.5 flex items-center gap-2.5"><div className="size-7 rounded-xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 border border-violet-500/20 grid place-items-center backdrop-blur"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-300"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg></div><span>Episodes</span><span className="ml-auto text-xs font-normal px-2.5 py-1 rounded-full bg-white/5 border border-white/10">S{season} • E{episode}</span></div>
                      <div className="flex gap-2 mb-3.5">
                        <select value={season} onChange={e=>setSeason(parseInt(e.target.value))} className="flex-1 h-10 rounded-xl bg-black/60 border border-white/10 px-3.5 text-[14px] outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 backdrop-blur font-medium">
                          {seasons.map(s=><option key={s} value={s}>Season {s}</option>)}
                        </select>
                        <select value={episode} onChange={e=>setEpisode(parseInt(e.target.value))} className="flex-1 h-10 rounded-xl bg-black/60 border border-white/10 px-3.5 text-[14px] outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 backdrop-blur font-medium">
                          {Array.from({length:30},(_,i)=>i+1).map(e=><option key={e} value={e}>Ep {e}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[280px] overflow-auto scrollbar-hide pr-1 -mr-1">
                        {Array.from({length:30},(_,i)=>i+1).map(ep=>(
                          <button key={ep} onClick={()=>{setEpisode(ep); if(window.innerWidth<768) setShowEpisodes(false)}} className={cn("h-10 sm:h-9 rounded-xl text-[13px] font-semibold border transition-all active:scale-90", ep===episode?"bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)] scale-105":"border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105 bg-white/[0.02] backdrop-blur")}>{ep}</button>
                        ))}
                      </div>
                      <button onClick={()=>setShowEpisodes(false)} className="md:hidden mt-3.5 w-full h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-medium text-sm active:scale-[0.98] transition">Done</button>
                    </div>
                  </div>
                </>
              )}

              {/* Show UI hint */}
              {!showPlayerUI && (
                <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-10">
                  <div className="px-3.5 py-2 rounded-full bg-black/80 backdrop-blur-2xl text-[11px] sm:text-xs text-zinc-300 border border-white/15 shadow-2xl flex items-center gap-2">
                    <div className="size-1 rounded-full bg-zinc-500 animate-pulse hidden sm:block" />
                    <span className="hidden sm:inline">Move mouse or tap to show controls</span>
                    <span className="sm:hidden">Tap for controls</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items, onOpen }: { title: string; items: Media[]; onOpen: (m:Media)=>void }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <h2 className="text-[18px] sm:text-[22px] font-bold tracking-tight flex items-center gap-2.5">
          <span className="relative">
            {title}
            <span className="absolute -bottom-1 left-0 w-8 h-[2px] bg-gradient-to-r from-violet-500 to-transparent rounded-full" />
          </span>
        </h2>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <span className="hidden sm:inline">{items.length} titles</span>
          <div className="size-1 rounded-full bg-zinc-700" />
          <span className="size-4 grid place-items-center rounded-full border border-zinc-800"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg></span>
        </div>
      </div>
      <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5 sm:gap-4 lg:gap-5">
        {items.map(m=> <Card key={m.id} m={m} onClick={()=>onOpen(m)} />)}
      </div>
    </div>
  );
}

function Card({ m, onClick }: { m: Media; onClick: ()=>void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isTouch, setIsTouch] = useState(false);
  
  useEffect(() => {
    setIsTouch('ontouchstart' in window);
  }, []);
  
  const onMove = (e: React.MouseEvent) => {
    if (isTouch || !ref.current) return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
    const y = ((e.clientY - r.top) / r.height - 0.5) * -8;
    el.style.transform = `perspective(1200px) rotateY(${x}deg) rotateX(${y}deg) scale3d(1.02,1.02,1.02)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = `perspective(1200px) rotateY(0) rotateX(0) scale3d(1,1,1)`;
  };

  return (
    <button ref={ref} onClick={onClick} onMouseMove={onMove} onMouseLeave={onLeave} className="group text-left transition-all duration-300 will-change-transform hover:z-10 active:scale-[0.97]">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[14px] sm:rounded-[18px] lg:rounded-[20px] bg-zinc-900 ring-1 ring-white/[0.06] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9)] group-hover:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.9)] group-hover:ring-white/15 transition-all duration-500">
        <img src={IMG(m.poster_path)} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-110 group-active:scale-105" loading="lazy" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-70 group-hover:opacity-90 transition-opacity duration-300" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 mix-blend-overlay" style={{background:`radial-gradient(500px at 50% 0%, rgba(139,92,246,0.25), transparent 60%)`}} />
        
        {/* Play button - desktop hover, mobile always visible but subtle */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className={cn("size-12 sm:size-14 rounded-full bg-white/95 backdrop-blur-2xl grid place-items-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all duration-500", isTouch ? "opacity-0 scale-75" : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100", "group-active:opacity-100 group-active:scale-90")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="black" className="translate-x-[1px]"><path d="M8 5.14v14l11-7-11-7z"/></svg>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 lg:p-3">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:hidden">
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/15 font-medium leading-none">★ {m.vote_average.toFixed(1)}</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/85 backdrop-blur-xl border border-white/20 font-medium shadow-lg leading-none">★ {m.vote_average.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Hover glow border */}
        <div className="absolute inset-0 rounded-[14px] sm:rounded-[18px] lg:rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_0_rgba(255,255,255,0.15)]" />
      </div>
      <div className="mt-2 sm:mt-2.5 space-y-0.5 px-0.5">
        <div className="line-clamp-1 text-[12px] sm:text-[13px] lg:text-[14px] font-medium text-zinc-200 group-hover:text-white transition-colors leading-snug">{m.title || m.name}</div>
        <div className="text-[10px] sm:text-[11px] lg:text-[12px] text-zinc-500 font-medium">{(m.release_date || m.first_air_date || "").slice(0,4) || "—"}</div>
      </div>
    </button>
  );
}

function PlayerFrame({ media, server, adblock, sandbox, season, episode }: { media: Media; server: any; adblock: number; sandbox: boolean; season: number; episode: number }) {
  const type = media.media_type==="tv"?"tv":"movie";
  const url = server.build(media.id, type, season, episode);
  const proxiedUrl = typeof window.proxyURL === "function" ? window.proxyURL(url) : url;
  
  const srcDoc = useMemo(() => {
    const blockScripts = [
      ``,
      `window.open=()=>null;`,
      `window.open=window.alert=window.confirm=()=>null;window.print=()=>{};`,
      `window.open=window.alert=window.confirm=window.prompt=()=>null;window.print=()=>{};Object.defineProperty(window,'open',{value:()=>null});history.pushState=history.replaceState=()=>{};Notification.requestPermission=()=>Promise.resolve('denied');window.onbeforeunload=null;`
    ][adblock] || "";

    const adblockCode = `
      (function(){
        try{
          ${blockScripts}
          const blockList = ['doubleclick','googlesyndication','adservice','adsystem','adnxs','popads','popcash','exoclick','hilltopads','propeller','adsterra','outbrain','taboola','cpmstar','juicyads'];
          const origOpen = window.open;
          window.open = function(u){try{const s=String(u||'');if(blockList.some(b=>s.includes(b)))return null;}catch{} return null};
          
          const kill = ()=>{try{document.querySelectorAll('a[target="_blank"]').forEach(a=>a.removeAttribute('target'))}catch{}};
          new MutationObserver(kill).observe(document.documentElement||document,{childList:true,subtree:true});
          
          document.addEventListener('click',e=>{let a=e.target.closest&&e.target.closest('a');if(a&&a.href&&blockList.some(b=>a.href.includes(b))){e.preventDefault();e.stopPropagation();return false}},true);
          
          let c=0;setInterval(()=>{try{if(c++>20)return;for(let i=0;i<50;i++){window.clearTimeout(i);window.clearInterval(i)}}catch{}},2000);
        }catch(e){}
      })();
    `;

    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;border:0;width:100%;height:100%;background:#000}</style><script>${adblockCode}</script></head>
<body><iframe src="${proxiedUrl.replace(/"/g,'&quot;')}" allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; gyroscope *; accelerometer *" allowfullscreen referrerpolicy="no-referrer"></iframe></body></html>`;
  }, [proxiedUrl, adblock]);
  
  return (
    <iframe
      key={proxiedUrl}
      srcDoc={srcDoc}
      className="absolute inset-0 w-full h-full bg-black"
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture; gyroscope; accelerometer"
      sandbox={sandbox ? "allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation" : undefined}
      referrerPolicy="no-referrer"
    />
  );
}
