/* Dynasty Loom on Babylon WebGPU: reader additions on top of the Demiurge set (same bundle scope, entries only added).
     Appearance.alphaMode   AUTO | OPAQUE | BLEND, as X_ITE's Appearance has it: the glow layers are BLEND, the sky and the fibre cores OPAQUE
     Viewpoint.navigationInfo  a NavigationInfo USE'd inside a Viewpoint (the Probe's NONE navigation): kept, not acted on, the page owns the camera */
Object.assign(DEFS.Appearance, { alphaMode: ['SFString', IO, 'AUTO'] });
Object.assign(DEFS.Viewpoint, { navigationInfo: ['SFNode', IO, null] });
Object.assign(CONTAINER, { NavigationInfo: 'navigationInfo' });
