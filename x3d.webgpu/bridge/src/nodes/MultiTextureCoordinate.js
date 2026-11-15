/* MultiTextureCoordinate (Texturing level 3): a list of TextureCoordinate nodes, one per texture channel (19775-1 18.4.5). The geometry's vertex data reads channel 0 (body-br.js, the outermost
   geometryData wrapper); a MultiTexture carries channel i as the affine map from channel 0 to channel i in its combine step. Fields: the Library hall port. */
BR.node('MultiTextureCoordinate', { component: 'Texturing', level: 3, container: 'texCoord' });
