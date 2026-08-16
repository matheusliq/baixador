import customtkinter as ctk
import threading
import json
import os
import subprocess
import sys
from pathlib import Path
from tkinter import filedialog

# ─── Configuração do tema ────────────────────────────────────────────────────
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

if getattr(sys, 'frozen', False):
    CONFIG_FILE = Path(sys.executable).parent / "config.json"
else:
    CONFIG_FILE = Path(__file__).parent / "config.json"
SUPABASE_URL = "https://lbfxonyshkxdbnhmnvxq.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZnhvbnlzaGt4ZGJuaG1udnhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTA0OTcsImV4cCI6MjEwMjQ2NjQ5N30.SWYryZq84bdFAx-mQyeT68SPmCXh_V0qHghXelQWzE4"


def carregar_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"pasta_download": str(Path.home() / "Downloads")}


def salvar_config(config):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Baixador de Louvores do João")
        self.geometry("750x600")
        self.resizable(True, True)
        self.minsize(600, 500)

        self.config = carregar_config()
        self.musicas_pendentes = []
        self.baixando = False

        self._build_ui()
        self._carregar_musicas()

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        # ── Cabeçalho ──────────────────────────────────────────────────────
        header = ctk.CTkFrame(self, corner_radius=0, fg_color="#1a1a2e")
        header.grid(row=0, column=0, sticky="ew", padx=0, pady=0)
        header.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            header,
            text="🎵 Baixador de Louvores do João",
            font=ctk.CTkFont(size=28, weight="bold"),
            text_color="#4a9eff",
        ).grid(row=0, column=0, padx=30, pady=(20, 5))

        self.lbl_status_geral = ctk.CTkLabel(
            header,
            text="Carregando músicas do celular...",
            font=ctk.CTkFont(size=14),
            text_color="#aaaaaa",
        )
        self.lbl_status_geral.grid(row=1, column=0, padx=30, pady=(0, 15))

        # ── Configuração de pasta ──────────────────────────────────────────
        pasta_frame = ctk.CTkFrame(self, fg_color="#16213e")
        pasta_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=(10, 5))
        pasta_frame.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            pasta_frame,
            text="📁 Pasta de destino:",
            font=ctk.CTkFont(size=13, weight="bold"),
        ).grid(row=0, column=0, padx=(15, 8), pady=12)

        self.lbl_pasta = ctk.CTkLabel(
            pasta_frame,
            text=self.config["pasta_download"],
            font=ctk.CTkFont(size=12),
            text_color="#4a9eff",
            anchor="w",
        )
        self.lbl_pasta.grid(row=0, column=1, sticky="ew", padx=5)

        ctk.CTkButton(
            pasta_frame,
            text="Alterar",
            width=90,
            height=32,
            font=ctk.CTkFont(size=12),
            command=self._escolher_pasta,
        ).grid(row=0, column=2, padx=(5, 15), pady=8)

        # ── Lista de músicas ───────────────────────────────────────────────
        lista_frame = ctk.CTkFrame(self)
        lista_frame.grid(row=2, column=0, sticky="nsew", padx=15, pady=5)
        lista_frame.grid_columnconfigure(0, weight=1)
        lista_frame.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(
            lista_frame,
            text="Músicas separadas pelo João (aguardando download):",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w",
        ).grid(row=0, column=0, sticky="w", padx=15, pady=(12, 5))

        self.btn_refresh = ctk.CTkButton(
            lista_frame,
            text="🔄 Reconectar / Atualizar",
            width=170,
            height=28,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#34495e",
            hover_color="#2c3e50",
            command=self._carregar_musicas,
        )
        self.btn_refresh.grid(row=0, column=1, sticky="e", padx=15, pady=(12, 5))

        self.scroll_frame = ctk.CTkScrollableFrame(lista_frame, label_text="")
        self.scroll_frame.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=10, pady=(0, 10))
        self.scroll_frame.grid_columnconfigure(0, weight=1)

        # ── Rodapé com progresso e botão ───────────────────────────────────
        rodape = ctk.CTkFrame(self, fg_color="#16213e")
        rodape.grid(row=3, column=0, sticky="ew", padx=15, pady=(5, 15))
        rodape.grid_columnconfigure(0, weight=1)

        self.progressbar = ctk.CTkProgressBar(rodape, height=18)
        self.progressbar.set(0)
        self.progressbar.grid(row=0, column=0, columnspan=2, padx=15, pady=(12, 5), sticky="ew")

        self.lbl_progresso = ctk.CTkLabel(
            rodape,
            text="",
            font=ctk.CTkFont(size=12),
            text_color="#aaaaaa",
        )
        self.lbl_progresso.grid(row=1, column=0, padx=15, sticky="w")

        self.btn_baixar = ctk.CTkButton(
            rodape,
            text="⬇  BAIXAR TUDO EM MP3",
            font=ctk.CTkFont(size=20, weight="bold"),
            height=60,
            fg_color="#2ecc71",
            hover_color="#27ae60",
            text_color="#000000",
            command=self._iniciar_download,
        )
        self.btn_baixar.grid(row=2, column=0, columnspan=2, padx=15, pady=(8, 15), sticky="ew")

    def _escolher_pasta(self):
        pasta = filedialog.askdirectory(
            title="Escolha a pasta de destino dos MP3s",
            initialdir=self.config["pasta_download"],
        )
        if pasta:
            self.config["pasta_download"] = pasta
            salvar_config(self.config)
            self.lbl_pasta.configure(text=pasta)

    def _carregar_musicas(self):
        """Busca músicas pendentes do Supabase em background."""
        self.lbl_status_geral.configure(
            text="Carregando músicas do celular...", text_color="#aaaaaa"
        )
        def buscar():
            try:
                from supabase import create_client
                client = create_client(SUPABASE_URL, SUPABASE_KEY)
                resp = client.table("musicas_separadas").select("*").eq("status", "pendente").execute()
                self.musicas_pendentes = resp.data or []
                self.after(0, self._renderizar_lista)
            except Exception as e:
                self.after(0, lambda: self.lbl_status_geral.configure(
                    text=f"❌ Erro ao conectar: {e}", text_color="#e74c3c"
                ))

        threading.Thread(target=buscar, daemon=True).start()

    def _renderizar_lista(self):
        # Limpa lista antiga
        for w in self.scroll_frame.winfo_children():
            w.destroy()

        n = len(self.musicas_pendentes)
        if n == 0:
            self.lbl_status_geral.configure(
                text="✅ Nenhuma música pendente. João ainda não separou nada!",
                text_color="#2ecc71",
            )
            self.btn_baixar.configure(state="disabled", text="Sem músicas para baixar")
            return

        self.lbl_status_geral.configure(
            text=f"🎵 {n} música{'s' if n > 1 else ''} pronta{'s' if n > 1 else ''} para baixar",
            text_color="#2ecc71",
        )

        for i, musica in enumerate(self.musicas_pendentes):
            row = ctk.CTkFrame(self.scroll_frame, fg_color="#1e1e2e", corner_radius=8)
            row.grid(row=i, column=0, sticky="ew", padx=5, pady=3)
            row.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(row, text=f"{i+1}.", font=ctk.CTkFont(size=13),
                         text_color="#666", width=30).grid(row=0, column=0, padx=(10, 5), pady=10)

            ctk.CTkLabel(row, text=musica.get("title", "Sem título"),
                         font=ctk.CTkFont(size=13), anchor="w").grid(
                row=0, column=1, sticky="ew", padx=5, pady=10)

            self._status_labels = getattr(self, "_status_labels", {})
            lbl = ctk.CTkLabel(row, text="⏳ Aguardando",
                               font=ctk.CTkFont(size=11), text_color="#888", width=110)
            lbl.grid(row=0, column=2, padx=(5, 12), pady=10)
            self._status_labels[musica["id"]] = lbl

    def _iniciar_download(self):
        if self.baixando or not self.musicas_pendentes:
            return
        self.baixando = True
        self.btn_baixar.configure(state="disabled", text="Baixando... aguarde")
        threading.Thread(target=self._worker_download, daemon=True).start()

    def _worker_download(self):
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)

        total = len(self.musicas_pendentes)
        pasta = self.config["pasta_download"]
        os.makedirs(pasta, exist_ok=True)

        for i, musica in enumerate(self.musicas_pendentes):
            vid_id = musica["id"]
            titulo = musica.get("title", vid_id)
            url_yt = f"https://www.youtube.com/watch?v={vid_id}"

            self.after(0, lambda t=titulo, idx=i, v=vid_id: (
                self.lbl_progresso.configure(text=f"Baixando {idx+1}/{total}: {t[:50]}..."),
                self.progressbar.set(idx / total),
                self._status_labels.get(v) and self._status_labels[v].configure(
                    text="⬇ Baixando...", text_color="#4a9eff"),
            ))

            try:
                ffmpeg_path = os.path.join(os.path.dirname(__file__), "..", "node_modules", "ffmpeg-static", "ffmpeg.exe")
                
                cmd = [
                    sys.executable, "-m", "yt_dlp",
                    "--extract-audio",
                    "--audio-format", "mp3",
                    "--audio-quality", "0",
                    "--output", os.path.join(pasta, "%(title)s.%(ext)s"),
                    "--no-playlist",
                    url_yt,
                ]
                
                if os.path.exists(ffmpeg_path):
                    cmd.extend(["--ffmpeg-location", ffmpeg_path])
                
                resultado = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

                import glob
                arquivos = glob.glob(os.path.join(pasta, f"*{titulo[:10]}*.mp3"))
                baixou = len(arquivos) > 0 or ("Destination:" in resultado.stdout) or ("has already been downloaded" in resultado.stdout)
                
                if baixou:
                    # Marca como baixado no Supabase
                    client.table("musicas_separadas").update({"status": "baixado"}).eq("id", vid_id).execute()
                    self.after(0, lambda v=vid_id: self._status_labels.get(v) and
                               self._status_labels[v].configure(text="✅ Baixado", text_color="#2ecc71"))
                else:
                    raise Exception(resultado.stderr[:200] if resultado.stderr else "Erro desconhecido ao baixar")

            except Exception as e:
                self.after(0, lambda v=vid_id, err=str(e): (
                    self._status_labels.get(v) and self._status_labels[v].configure(
                        text="❌ Erro", text_color="#e74c3c"),
                    print(f"Erro em {v}: {err}"),
                ))

        # Finalizado
        self.after(0, self._finalizar)

    def _finalizar(self):
        self.progressbar.set(1)
        self.lbl_progresso.configure(text="✅ Todos os downloads concluídos!", text_color="#2ecc71")
        self.btn_baixar.configure(
            text="✅ CONCLUÍDO — PODE RETIRAR O PEN DRIVE",
            fg_color="#f39c12",
            hover_color="#e67e22",
            state="disabled",
        )
        self.baixando = False
        # Recarrega a lista para refletir os baixados
        self._carregar_musicas()


if __name__ == "__main__":
    app = App()
    app.mainloop()
