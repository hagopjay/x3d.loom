import sys, math
from PIL import Image
import numpy as np
a=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float); b=np.asarray(Image.open(sys.argv[2]).convert('RGB').resize(Image.open(sys.argv[1]).size)).astype(float)
mse=((a-b)**2).mean(); psnr=99 if mse==0 else 10*math.log10(255*255/mse)
m=(a.max(2)>14)|(b.max(2)>14)
print('psnr %.2f dB  mean(mine) %s  mean(xite) %s over %d px'%(psnr,a[m].mean(0).round(1),b[m].mean(0).round(1),m.sum()))
