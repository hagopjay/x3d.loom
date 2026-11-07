import sys
s=open(sys.argv[1]).read()
a="const context = canvas.getContext('webgpu');"
assert a in s
b="""const context = { _t: null, configure() {}, getCurrentTexture() { const w = canvas.width, h = canvas.height; if (!this._t || this._t.width !== w || this._t.height !== h) { this._t = device.createTexture({ size: [w, h], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }); } return this._t; } };"""
s=s.replace(a,b)
open(sys.argv[2],'w').write(s)
