from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import math, os

OUT = os.path.join(os.path.dirname(__file__), "assets")
S = 1024

def gradient(c1, c2, c3=None):
    y, x = np.mgrid[0:S, 0:S]
    d = np.sqrt(((x - S*0.35)**2 + (y - S*0.28)**2)) / (S*1.25)
    d = np.clip(d, 0, 1)
    a = np.array(c1, dtype=float)
    b = np.array(c2, dtype=float)
    if c3 is None:
        mix = a[None,None,:]*(1-d[...,None]) + b[None,None,:]*d[...,None]
    else:
        e = np.clip((d-0.55)/0.45, 0, 1)[...,None]
        mid = a[None,None,:]*(1-d[...,None]) + b[None,None,:]*d[...,None]
        mix = mid*(1-e) + np.array(c3, dtype=float)[None,None,:]*e
    return Image.fromarray(np.uint8(np.clip(mix,0,255)), "RGB").convert("RGBA")

def grain(img, amount=9):
    arr = np.array(img).astype(np.int16)
    rng = np.random.default_rng(7)
    noise = rng.normal(0, amount, (S,S,1))
    arr[...,:3] = np.clip(arr[...,:3] + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def save(img, name):
    img = img.convert("RGB").resize((512,512), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, quality=88, optimize=True)
    print(path, os.path.getsize(path))

# Lin: a quiet arch, sun, and branch
img = gradient((243,228,214), (223,187,164), (198,158,135))
d = ImageDraw.Draw(img, "RGBA")
d.ellipse((272, 178, 752, 658), fill=(250,243,233,210))
d.rectangle((272, 418, 752, 900), fill=(250,243,233,210))
d.ellipse((514, 292, 610, 388), fill=(197,111,82,235))
# arch outline
d.arc((262,168,762,668), 180, 360, fill=(43,38,32,210), width=7)
d.line((262,418,262,940), fill=(43,38,32,210), width=7)
d.line((762,418,762,940), fill=(43,38,32,210), width=7)
# branch
d.line((390,760,390,560), fill=(43,38,32,190), width=5)
for i,(x,y,rx,ry,ang) in enumerate([(414,610,62,22,28),(366,674,58,20,-32),(410,710,55,19,24),(360,576,49,17,-28)]):
    leaf = Image.new("RGBA",(int(rx*2+20),int(ry*2+20)),(0,0,0,0))
    ld = ImageDraw.Draw(leaf)
    ld.ellipse((10,10,10+rx*2,10+ry*2), fill=(43,38,32,165))
    leaf = leaf.rotate(ang, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(leaf, (x-leaf.width//2, y-leaf.height//2))
# quiet horizon
d.line((180,864,844,864), fill=(43,38,32,80), width=3)
img = grain(img.filter(ImageFilter.GaussianBlur(0.35)), 7)
save(img, "lin.jpg")

# Zhou: a rust sun above a dark hill
img = gradient((235,229,211), (190,198,175), (147,161,142))
d = ImageDraw.Draw(img, "RGBA")
d.ellipse((330, 240, 694, 604), fill=(198,114,82,225))
# hill layers with curves
d.polygon([(0,720),(180,650),(360,700),(540,622),(760,692),(1024,590),(1024,1024),(0,1024)], fill=(49,55,44,230))
d.polygon([(0,820),(230,760),(430,810),(650,742),(850,792),(1024,744),(1024,1024),(0,1024)], fill=(35,38,31,245))
# thin constellation lines
for pts in [[(194,196),(284,152),(330,214)],[(812,160),(872,238),(790,288)]]:
    d.line(pts, fill=(250,244,234,150), width=3)
    for p in pts:
        d.ellipse((p[0]-5,p[1]-5,p[0]+5,p[1]+5), fill=(250,244,234,200))
img = grain(img.filter(ImageFilter.GaussianBlur(0.3)), 8)
save(img, "zhou.jpg")
