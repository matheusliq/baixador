import PyInstaller.__main__
import os
import sys

def build():
    print("📦 Preparando build do Desktop App...")

    ffmpeg_src = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
    )

    args = [
        'app.py',
        '--name=BaixadorMusicas',
        '--onefile',
        '--windowed',
        '--additional-hooks-dir=hooks',
        '--hidden-import=yt_dlp',
        '--hidden-import=supabase',
        '--hidden-import=customtkinter',
        '--hidden-import=dotenv',
        '--collect-all=yt_dlp',
        '--collect-all=customtkinter',
        '--clean',
        '--noconfirm',
    ]

    if os.path.exists(ffmpeg_src):
        print(f"➕ Incluindo ffmpeg no executável de: {ffmpeg_src}")
        args.append(f'--add-binary={ffmpeg_src};.')
    else:
        print("⚠️ Aviso: ffmpeg.exe não encontrado em node_modules!")

    PyInstaller.__main__.run(args)
    print("✅ Build concluído! O executável está em: dist/BaixadorMusicas.exe")

if __name__ == '__main__':
    build()
