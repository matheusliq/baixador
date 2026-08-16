import PyInstaller.__main__
import os
import sys

def build():
    print("📦 Preparando build do Desktop App...")
    
    PyInstaller.__main__.run([
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
    ])
    
    print("✅ Build concluído! O executável está em: dist/BaixadorMusicas.exe")

if __name__ == '__main__':
    build()
