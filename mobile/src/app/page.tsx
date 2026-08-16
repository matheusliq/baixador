"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { Mic, Search, Trash2, CheckCircle2, Music, Download, Play, Pause } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import SongThumbnail from "@/components/SongThumbnail";
type Song = {
  id: string;
  title: string;
  thumbnail: string;
  status: "pendente" | "baixado";
};


function MainContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [activeTab, setActiveTab] = useState<"busca" | "fila" | "historico">("busca");
  const [isListening, setIsListening] = useState(false);

  const [playingSong, setPlayingSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [played, setPlayed] = useState(0); // 0 a 1
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchSupabaseData();
    const shareUrl = searchParams.get("share_url");
    if (shareUrl) { setSearchQuery(shareUrl); setActiveTab("busca"); handleSearch(shareUrl); }
  }, [searchParams]);

  // togglePlay: controla o audio diretamente para evitar race conditions com estado React
  const togglePlay = (song: Song) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingSong?.id === song.id) {
      // Mesma musica: toggle direto no elemento
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(console.error);
        setIsPlaying(true);
      }
    } else {
      // Nova musica: troca o src e da play depois do load
      setIsLoadingAudio(true);
      setPreviewError(null);
      setPlayed(0);
      setPlayingSong(song);
      // NAO chama setIsPlaying aqui — o onCanPlay vai fazer isso
      audio.pause(); // para audio anterior sem setar estado
      audio.src = `/api/audio/${song.id}`;
      audio.load();
    }
  };

  // Quando o audio estiver pronto para tocar (apos load)
  const handleCanPlay = () => {
    const audio = audioRef.current;
    if (!audio || !playingSong) return;
    audio.play()
      .then(() => { setIsPlaying(true); setIsLoadingAudio(false); })
      .catch((e) => {
        // AbortError e normal durante troca rapida de musica, ignorar
        if (e.name !== "AbortError") console.error("Erro play:", e);
        setIsLoadingAudio(false);
      });
  };

  const fetchSupabaseData = async () => {
    const { data, error } = await supabase.from("musicas_separadas").select("*").order("created_at", { ascending: false });
    if (error) { console.error("Erro Supabase:", error); return; }
    if (data) {
      setQueue(data.filter((s: any) => s.status === "pendente"));
      setHistory(data.filter((s: any) => s.status === "baixado"));
    }
  };

  const handleSearch = async (queryOverride?: string) => {
    const q = queryOverride || searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setSearchResults(await res.json());
    } catch (e) { console.error("Erro busca", e); }
    finally { setIsSearching(false); }
  };

  const handleVoiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voz nao suportada."); return; }
    const r = new SR(); r.lang = "pt-BR";
    r.onstart = () => setIsListening(true);
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setSearchQuery(t); handleSearch(t); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start();
  };

  const addToQueue = async (song: Song) => {
    const newSong = { ...song, status: "pendente" as const };
    setQueue([newSong, ...queue]);
    const { id, title, thumbnail, status } = newSong;
    const { error } = await supabase.from("musicas_separadas").insert([{ id, title, thumbnail, status }]);
    if (error) { console.error("Erro salvar:", error); setQueue(queue.filter(s => s.id !== song.id)); }
  };

  const deleteSong = async (id: string) => {
    const oldQ = [...queue];
    const oldH = [...history];
    setQueue(queue.filter((s) => s.id !== id));
    setHistory(history.filter((s) => s.id !== id));
    const { error } = await supabase.from("musicas_separadas").delete().eq("id", id);
    if (error) { 
      console.error("Erro deletar:", error); 
      setQueue(oldQ); 
      setHistory(oldH); 
    }
  };

  const SongCard = ({ song, border = false }: { song: Song; border?: boolean }) => {
    const isThisSong = playingSong?.id === song.id;
    const isThisPlaying = isThisSong && isPlaying;

    return (
      <div className={`bg-white p-3 rounded-2xl shadow-sm flex flex-col gap-3 ${border ? "border-l-4 border-emerald-500" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <SongThumbnail videoId={song.id} alt={song.title} className="w-32 h-24 object-cover rounded-xl" />
            <button onClick={() => togglePlay(song)}
              className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center rounded-xl active:bg-opacity-60">
              {isThisSong && isLoadingAudio
                ? <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
                : isThisPlaying
                  ? <Pause className="w-12 h-12 text-white drop-shadow" />
                  : <Play className="w-12 h-12 text-white drop-shadow" />
              }
            </button>
          </div>
          <h3 className="text-base font-bold leading-tight flex-1">{song.title}</h3>
        </div>

        {/* Barra de progresso real — só aparece na música ativa */}
        {isThisSong && (
          <div className="w-full">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={played || 0}
              className="w-full h-2 rounded-lg cursor-pointer accent-blue-600 bg-gray-200 outline-none"
              onInput={(e) => {
                setPlayed(parseFloat((e.target as HTMLInputElement).value));
              }}
              onChange={(e) => {
                const ratio = parseFloat((e.target as HTMLInputElement).value);
                if (audioRef.current?.duration) {
                  audioRef.current.currentTime = ratio * audioRef.current.duration;
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              {isLoadingAudio ? "Carregando audio..." : isPlaying ? "▶ Ouvindo previa..." : "⏸ Pausado"}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-gray-900 pb-20">
      {/* Player de audio invisivel — nativo do navegador, sem video */}
      <audio
        ref={audioRef}
        onCanPlay={handleCanPlay}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setPlayed(a.currentTime / a.duration);
        }}
        onEnded={() => { setIsPlaying(false); setPlayed(0); setPlayingSong(null); }}
        onError={(e) => { 
          console.error("Audio error:", e); 
          setIsLoadingAudio(false); 
          setIsPlaying(false);
          setPreviewError("Prévia de áudio indisponível ou bloqueada pelo YouTube.");
        }}
      />

      <header className="bg-blue-600 text-white p-6 shadow-md rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Music className="w-8 h-8" /> Baixador do Joao</h1>
        <p className="text-blue-100 text-lg mt-1">Busque e separe suas musicas</p>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6">
        
        {previewError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl shadow-sm text-center font-semibold">
            ⚠️ {previewError}
          </div>
        )}

        <div className="flex bg-white rounded-full p-1 shadow-sm">
          {(["busca", "fila", "historico"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-2 text-lg font-bold rounded-full transition-colors relative ${activeTab === tab ? "bg-blue-600 text-white shadow" : "text-gray-500"}`}>
              {tab === "busca" ? "Buscar" : tab === "fila" ? "Separadas" : "Baixadas"}
              {tab === "fila" && queue.length > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{queue.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "busca" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white p-4 rounded-3xl shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Nome da musica ou Link..."
                  className="flex-1 text-xl p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => handleSearch()} className="bg-blue-100 text-blue-600 p-4 rounded-2xl active:bg-blue-200">
                  <Search className="w-8 h-8" />
                </button>
              </div>
              <button onClick={handleVoiceSearch}
                className={`w-full py-5 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 shadow-lg ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-blue-600 text-white active:bg-blue-700"}`}>
                <Mic className="w-8 h-8" />{isListening ? "Ouvindo..." : "Falar o nome da musica"}
              </button>
            </div>

            {isSearching && <div className="text-center text-xl text-gray-500 my-8">Buscando no YouTube...</div>}

            {!isSearching && searchResults.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-gray-700 px-2">Resultados:</h2>
                {searchResults.map((song) => {
                  const isAdded = queue.find((s) => s.id === song.id) || history.find((s) => s.id === song.id);
                  return (
                    <div key={song.id} className="flex flex-col gap-3">
                      <SongCard song={song} />
                      <button onClick={() => addToQueue(song)} disabled={!!isAdded}
                        className={`w-full py-4 rounded-xl text-xl font-bold flex items-center justify-center gap-2 ${isAdded ? "bg-gray-200 text-gray-500" : "bg-emerald-500 text-white shadow-md active:bg-emerald-600"}`}>
                        {isAdded ? <><CheckCircle2 className="w-6 h-6" /> Ja Separado</> : "+ Separar para Baixar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "fila" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-700 px-2 flex justify-between items-center">
              Musicas Separadas <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-lg">{queue.length}</span>
            </h2>
            {queue.length === 0
              ? <div className="text-center text-xl text-gray-500 my-10 bg-white p-8 rounded-3xl shadow-sm">Nenhuma musica separada ainda.</div>
              : queue.map((song) => (
                <div key={song.id} className="flex flex-col gap-2">
                  <SongCard song={song} border />
                  <button onClick={() => deleteSong(song.id)}
                    className="w-full py-4 rounded-xl text-xl font-bold bg-red-100 text-red-600 flex items-center justify-center gap-2 active:bg-red-200">
                    <Trash2 className="w-6 h-6" /> Excluir se errou
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {activeTab === "historico" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-700 px-2 flex justify-between items-center">
              Já passadas pro Pen Drive <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-lg">{history.length}</span>
            </h2>
            {history.length === 0
              ? <div className="text-center text-xl text-gray-500 my-10 bg-white p-8 rounded-3xl shadow-sm">Nenhuma música baixada ainda.</div>
              : history.map((song) => (
                <div key={song.id} className="bg-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SongThumbnail videoId={song.id} alt={song.title} className="w-20 h-16 object-cover rounded-xl flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold leading-tight truncate">{song.title}</h3>
                      <p className="text-emerald-600 font-semibold text-xs flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-4 h-4" /> Baixado com sucesso
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteSong(song.id)}
                    title="Excluir do histórico"
                    className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 active:bg-red-300 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            }
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <MainContent />
    </Suspense>
  );
}
