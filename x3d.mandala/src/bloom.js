// Screen-space halo bloom for a renderer that has none (X_ITE 16.8.0 offers
// tone mapping and exposure but no bloom). One down-sampled copy of the WebGL
// canvas (1/4) feeds a second (1/10); the compositor blurs both and
// screen-blends them over the frame. Needs preserveDrawingBuffer="true" on the
// x3d-canvas so the copy is stable. It reads pixels only; geometry and the
// scene graph are never touched.
//
// The copy can stall software renderers (SwiftShader, llvmpipe) on a pixel
// readback, so bloom starts off there, and a governor switches it off if the
// median frame time with bloom passes `budgetMs` after a warm-up.
export function softwareRenderer(gl){
  try{const ext=gl.getExtension('WEBGL_debug_renderer_info');const name=String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render/i.test(name)?name:'';}catch{return '';}
}
export class Bloom{
  constructor(source,anchor,{budgetMs=30,warmupFrames=90,onGovern}={}){
    this.source=source;this.enabled=true;this.budgetMs=budgetMs;this.warmup=warmupFrames;this.onGovern=onGovern;this.samples=[];this.governed=false;this.last=0;
    this.layers=[['near',4],['far',10]].map(([name,div])=>{
      const c=document.createElement('canvas');c.className='bloom '+name;c.setAttribute('aria-hidden','true');anchor.after(c);
      return {canvas:c,ctx:c.getContext('2d',{alpha:false}),div};
    });
  }
  setEnabled(on){this.enabled=!!on;this.samples.length=0;this.last=0;for(const l of this.layers)l.canvas.hidden=!this.enabled;}
  _govern(now){
    if(this.last){this.samples.push(now-this.last);if(this.samples.length>this.warmup)this.samples.shift();}this.last=now;
    if(this.samples.length<this.warmup)return;
    const sorted=[...this.samples].sort((a,b)=>a-b),median=sorted[sorted.length>>1];
    if(median>this.budgetMs){this.governed=true;this.setEnabled(false);this.onGovern?.(median);}
  }
  draw(intensity=.6,now=performance.now()){
    if(!this.enabled)return;const w=this.source.width,h=this.source.height;if(!w||!h)return;
    let from=this.source,fw=w,fh=h;
    for(const l of this.layers){
      const cw=Math.max(1,Math.round(w/l.div)),ch=Math.max(1,Math.round(h/l.div));
      if(l.canvas.width!==cw||l.canvas.height!==ch){l.canvas.width=cw;l.canvas.height=ch;}
      l.ctx.drawImage(from,0,0,fw,fh,0,0,cw,ch);from=l.canvas;fw=cw;fh=ch;
      l.canvas.style.opacity=String(Math.max(0,Math.min(1,intensity*(l.div>5?.85:.6))));
    }
    this._govern(now);
  }
}
