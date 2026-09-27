"""
app/favicon.ico 를 굽는다.

Next는 app/favicon.ico 를 다른 아이콘 설정보다 먼저 쓴다. 여기 프레임워크
기본값이 들어 있으면 메타데이터로 아무리 지정해도 그게 보인다. 실제로 그래서
한동안 Vercel 아이콘이 떠 있었다.

.ico 한 파일에 여러 크기를 담는다. 브라우저가 쓰이는 자리에 맞는 것을 고른다.

실행:  python3 scripts/make-favicon.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / "assets" / "icon-source.png").convert("RGBA")
src.save(
    ROOT / "app" / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("만듦: app/favicon.ico")
