import re, pathlib

p = pathlib.Path("app/seed.py")
s = p.read_text(encoding="utf-8")
LOCAL = "/placeholder-generic.svg"
LOCAL_AVATAR = "/placeholder-avatar.svg"

# Replace all external image URLs from freepik/magnific with local placeholder paths
# 1) avatar URLs
s = re.sub(r'avatar_url="https://img\.[a-z]+\.com/[^"]+"', f'avatar_url="{LOCAL_AVATAR}"', s)
# 2) All other external image_url occurrences
s = re.sub(r'image_url="https://img\.[a-z]+\.com/[^"]+"', f'image_url="{LOCAL}"', s)
# 3) Catch any remaining https image references
s = re.sub(r'"https://[^"]+\.(?:jpg|jpeg|png|webp|gif)"', f'"{LOCAL}"', s)

p.write_text(s, encoding="utf-8")
remaining = re.findall(r'https?://[^"\s]+', s)
print("Remaining external URLs:", len(remaining))
for url in remaining[:10]:
    print(" -", url)
