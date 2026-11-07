import sys
from PIL import Image
import numpy as np
A=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
B=np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(float)
for name,(y0,y1,x0,x1) in {'sky':(5,45,250,400),'mountainL':(80,110,100,170),'mountainR':(95,110,520,600),'road':(280,340,20,120),'grass-near':(200,240,420,470),'car':(215,240,290,340)}.items():
    print('%-10s me %s  xite %s'%(name,A[y0:y1,x0:x1].mean((0,1)).round(0),B[y0:y1,x0:x1].mean((0,1)).round(0)))
