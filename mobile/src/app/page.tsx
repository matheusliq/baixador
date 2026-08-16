"use client";

import { useState, useEffect, Suspense } from "react";
import { Mic, Search, Trash2, CheckCircle2, Music, Play, Pause } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import SongThumbnail from "@/components/SongThumbnail";

type Song = {
  id: string;
  title: string;
  thumbnail: string;
  duration?: string;
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

  const searchParams = useSearchParams();

  // Helper para salvar estado local persistente
  const saveToLocalStorage = (newQueue: Song[], newHistory: Song[]) => {
    try {
      localStorage.setItem("baixador_queue", JSON.stringify(newQueue));
      localStorage.setItem("baixador_history", JSON.stringify(newHistory));
    } catch (e) {
      console.error("Erro LocalStorage:", e);
    }
  };

  // 1. Carrega de imediato do LocalStorage (0ms - F5 instantâneo)
  useEffect(() => {
    try {
      const savedQ = localStorage.getItem("baixador_queue");
      const savedH = localStorage.getItem("baixador_history");
      if (savedQ) setQueue(JSON.parse(savedQ));
      if (savedH) setHistory(JSON.parse(savedH));
    } catch (e) {
      console.error("Erro ao ler LocalStorage:", e);
    }
    fetchSupabaseData();
  }, []);

  useEffect(() => {
    const shareUrl = searchParams.get("share_url");
    if (shareUrl) {
      setSearchQuery(shareUrl);
      setActiveTab("busca");
      handleSearch(shareUrl);
    }
  }, [searchParams]);

  const togglePlay = (song: Song) => {
    if (playingSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setPlayingSong(song);
      setIsPlaying(true);
    }
  };

  // 2. Busca e sincroniza com o Supabase em background sem zerar dados locais se falhar
  const fetchSupabaseData = async () => {
    try {
      const { data, error } = await supabase
        .from("musicas_separadas")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const q = data.filter((s: any) => s.status === "pendente");
        const h = data.filter((s: any) => s.status === "baixado");
        setQueue(q);
        setHistory(h);
        saveToLocalStorage(q, h);
      }
    } catch (err) {
      console.warn("Supabase indisponível, mantendo dados locais do LocalStorage:", err);
    }
  };

  const handleSearch = async (queryOverride?: string) => {
    const q = queryOverride || searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setSearchResults(await res.json());
    } catch (e) {
      console.error("Erro busca", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVoiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    const r = new SR();
    r.lang = "pt-BR";
    r.onstart = () => setIsListening(true);
    r.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setSearchQuery(t);
      handleSearch(t);
      setIsListening(false);
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start();
  };

  const addToQueue = async (song: Song) => {
    const newSong: Song = { ...song, status: "pendente" };

    // Atualiza estado local e LocalStorage imediatamente (nunca perde no F5)
    setQueue((prevQueue) => {
      const updatedQ = [newSong, ...prevQueue.filter((s) => s.id !== song.id)];
      saveToLocalStorage(updatedQ, history);
      return updatedQ;
    });

    // Sincroniza em background com Supabase
    const { id, title, thumbnail, status } = newSong;
    try {
      const { error } = await supabase
        .from("musicas_separadas")
        .upsert([{ id, title, thumbnail, status }], { onConflict: "id" });

      if (error) {
        console.error("Aviso Supabase upsert:", error);
      }
    } catch (e) {
      console.warn("Erro de conexão Supabase:", e);
    }
  };

  const deleteSong = async (id: string) => {
    // Atualiza estado local e LocalStorage imediatamente
    setQueue((prevQ) => {
      const updatedQ = prevQ.filter((s) => s.id !== id);
      setHistory((prevH) => {
        const updatedH = prevH.filter((s) => s.id !== id);
        saveToLocalStorage(updatedQ, updatedH);
        return updatedH;
      });
      return updatedQ;
    });

    // Deleta do Supabase em background
    try {
      await supabase.from("musicas_separadas").delete().eq("id", id);
    } catch (e) {
      console.warn("Erro de conexão Supabase ao deletar:", e);
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
            <button
              onClick={() => togglePlay(song)}
              className="absolute inset-0 m-auto w-12 h-12 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-lg"
              title={isThisPlaying ? "Fechar prévia" : "Ouvir prévia"}
            >
              {isThisPlaying ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold leading-tight">{song.title}</h3>
            {song.duration && (
              <span className="inline-block mt-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                ⏱ {song.duration}
              </span>
            )}
          </div>
        </div>

        {isThisPlaying && (
          <div className="w-full mt-1 bg-blue-50/60 p-3 rounded-2xl border border-blue-200/80 flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-blue-700 font-bold flex items-center gap-1">
                ▶ Tocando prévia do louvor
              </span>
              <button
                onClick={() => setIsPlaying(false)}
                className="text-xs text-red-600 font-bold hover:underline bg-red-100 px-2 py-0.5 rounded-lg"
              >
                Fechar prévia
              </button>
            </div>
            <div className="w-full h-48 rounded-xl overflow-hidden shadow-sm bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${song.id}?autoplay=1&playsinline=1&controls=1`}
                allow="autoplay; encrypted-media"
                className="w-full h-full border-0"
                title={song.title}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-gray-900 pb-20">
      <header className="bg-blue-600 text-white p-6 shadow-md rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Music className="w-8 h-8" /> Baixador do João
        </h1>
        <p className="text-blue-100 text-lg mt-1">Busque e separe suas músicas</p>
      </header>

      <main className="flex-1 p-4 flex flex-col gap-6">
        <div className="flex bg-white rounded-full p-1 shadow-sm">
          {(["busca", "fila", "historico"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-2 text-lg font-bold rounded-full transition-colors relative ${
                activeTab === tab ? "bg-blue-600 text-white shadow" : "text-gray-500"
              }`}
            >
              {tab === "busca" ? "Buscar" : tab === "fila" ? "Separadas" : "Baixadas"}
              {tab === "fila" && queue.length > 0 && (
                <span className="absolute top-1 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {queue.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "busca" && (
          <div className="flex flex-col gap-6">
            <div className="bg-white p-4 rounded-3xl shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Nome da música ou Link..."
                  className="flex-1 text-xl p-4 bg-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleSearch()}
                  className="bg-blue-100 text-blue-600 p-4 rounded-2xl active:bg-blue-200"
                >
                  <Search className="w-8 h-8" />
                </button>
              </div>
              <button
                onClick={handleVoiceSearch}
                className={`w-full py-5 rounded-2xl text-xl font-bold flex items-center justify-center gap-3 shadow-lg ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-blue-600 text-white active:bg-blue-700"
                }`}
              >
                <Mic className="w-8 h-8" />
                {isListening ? "Ouvindo..." : "Falar o nome da música"}
              </button>
            </div>

            {isSearching && (
              <div className="text-center text-xl text-gray-500 my-8">Buscando no YouTube...</div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-gray-700 px-2">Resultados:</h2>
                {searchResults.map((song) => {
                  const isAdded =
                    queue.find((s) => s.id === song.id) || history.find((s) => s.id === song.id);
                  return (
                    <div key={song.id} className="flex flex-col gap-3">
                      <SongCard song={song} />
                      <button
                        onClick={() => addToQueue(song)}
                        disabled={!!isAdded}
                        className={`w-full py-4 rounded-xl text-xl font-bold flex items-center justify-center gap-2 ${
                          isAdded
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-emerald-500 text-white shadow-md active:bg-emerald-600"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle2 className="w-6 h-6" /> Já Separado
                          </>
                        ) : (
                          "+ Separar para Baixar"
                        )}
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
              Músicas Separadas{" "}
              <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-lg">
                {queue.length}
              </span>
            </h2>
            {queue.length === 0 ? (
              <div className="text-center text-xl text-gray-500 my-10 bg-white p-8 rounded-3xl shadow-sm">
                Nenhuma música separada ainda.
              </div>
            ) : (
              queue.map((song) => (
                <div key={song.id} className="flex flex-col gap-2">
                  <SongCard song={song} border />
                  <button
                    onClick={() => deleteSong(song.id)}
                    className="w-full py-4 rounded-xl text-xl font-bold bg-red-100 text-red-600 flex items-center justify-center gap-2 active:bg-red-200"
                  >
                    <Trash2 className="w-6 h-6" /> Excluir se errou
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "historico" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-gray-700 px-2 flex justify-between items-center">
              Já passadas pro Pen Drive{" "}
              <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-lg">
                {history.length}
              </span>
            </h2>
            {history.length === 0 ? (
              <div className="text-center text-xl text-gray-500 my-10 bg-white p-8 rounded-3xl shadow-sm">
                Nenhuma música baixada ainda.
              </div>
            ) : (
              history.map((song) => (
                <div
                  key={song.id}
                  className="bg-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SongThumbnail
                      videoId={song.id}
                      alt={song.title}
                      className="w-20 h-16 object-cover rounded-xl flex-shrink-0"
                    />
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
            )}
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
