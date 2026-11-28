# scenes-260, visible nodes: engine vs X_ITE (object-pixel MAE, 0-255)

Judge AGREE<=2, NEAR<=8, FAR>8. BLANK = X_ITE and the engine both draw nothing (no content compared).

| node | component | xsd | three | babylon | wgpu |
|---|---|---|---|---|---|
| AcousticProperties | Shape | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| Appearance | Shape | ok | AGREE 0.128 | AGREE 0.678 | AGREE 0.678 |
| Arc2D | Geometry2D | ok | AGREE 0.0 | **FAR 120.545** | **FAR 151.74** |
| ArcClose2D | Geometry2D | ok | AGREE 0.0 | NEAR 6.339 | **FAR 246.394** |
| Background | EnvironmentalEffects | ok | **FAR 14.153** | **FAR 14.25** | **FAR 53.119** |
| Billboard | Navigation | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| BlendedVolumeStyle | VolumeRendering | ok | AGREE 1.0 | AGREE 0.0 | **FAR 127.0** |
| BoundaryEnhancementVolumeStyle | VolumeRendering | ok | NEAR 2.011 | AGREE 1.064 | **FAR 251.925** |
| Box | Geometry3D | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| CADAssembly | CADGeometry | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| CADFace | CADGeometry | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| CADLayer | CADGeometry | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| CADPart | CADGeometry | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| CartoonVolumeStyle | VolumeRendering | ok | NEAR 2.033 | AGREE 0.0 | **FAR 217.539** |
| Circle2D | Geometry2D | ok | AGREE 0.0 | **FAR 122.974** | **FAR 153.552** |
| ClipPlane | Rendering | ok | AGREE 0.936 | AGREE 1.168 | **FAR 44.337** |
| Collision | Navigation | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| Color | Rendering | ok | AGREE 0.408 | NEAR 2.012 | AGREE 0.0 |
| ColorRGBA | Rendering | ok | **FAR 83.457** | **FAR 85.223** | AGREE 0.0 |
| ComposedCubeMapTexture | CubeMapTexturing | ok | **FAR 252.967** | NEAR 2.033 | NEAR 2.033 |
| ComposedShader | Shaders | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| ComposedTexture3D | Texturing3D | ok | **FAR 252.967** | **FAR 252.967** | NEAR 2.033 |
| ComposedVolumeStyle | VolumeRendering | ok | AGREE 0.713 | AGREE 0.0 | **FAR 131.765** |
| Cone | Geometry3D | ok | AGREE 1.542 | NEAR 6.31 | NEAR 4.832 |
| Coordinate | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| CoordinateDouble | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| Cylinder | Geometry3D | ok | NEAR 3.837 | NEAR 4.326 | NEAR 3.997 |
| DirectionalLight | Lighting | ok | AGREE 0.252 | AGREE 1.43 | AGREE 0.261 |
| Disk2D | Geometry2D | ok | AGREE 1.372 | NEAR 5.706 | **FAR 248.321** |
| EdgeEnhancementVolumeStyle | VolumeRendering | ok | AGREE 0.484 | AGREE 0.005 | **FAR 138.555** |
| ElevationGrid | Geometry3D | ok | AGREE 0.0 | **FAR 63.966** | AGREE 0.0 |
| Extrusion | Geometry3D | ok | AGREE 0.0 | NEAR 3.049 | **FAR 251.951** |
| FillProperties | Shape | ok | AGREE 0.0 | AGREE 1.016 | **FAR 191.52** |
| FloatVertexAttribute | Shaders | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| Fog | EnvironmentalEffects | ok | AGREE 0.799 | AGREE 1.634 | AGREE 0.908 |
| FogCoordinate | EnvironmentalEffects | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| FontStyle | Text | ok | **FAR 15.793** | **FAR 219.963** | **FAR 220.311** |
| GeneratedCubeMapTexture | CubeMapTexturing | ok | AGREE 0.333 | **FAR 100.151** | **FAR 97.852** |
| GeoCoordinate | Geospatial | ok | AGREE 0.057 | AGREE 0.851 | **FAR 201.362** |
| GeoElevationGrid | Geospatial | ok | AGREE 0.0 | NEAR 2.247 | **FAR 111.148** |
| GeoLocation | Geospatial | ok | AGREE 0.398 | AGREE 0.914 | **FAR 113.753** |
| GeoOrigin | Geospatial | ok | AGREE 0.398 | AGREE 0.914 | **FAR 113.753** |
| GeoTransform | Geospatial | ok | AGREE 0.0 | NEAR 2.033 | **FAR 252.967** |
| Group | Grouping | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| HAnimHumanoid | HAnim | ok | AGREE 0.459 | AGREE 0.0 | **FAR 204.0** |
| HAnimJoint | HAnim | ok | AGREE 0.459 | AGREE 0.0 | **FAR 204.0** |
| HAnimSegment | HAnim | ok | AGREE 0.0 | NEAR 2.033 | **FAR 252.967** |
| HAnimSite | HAnim | ok | AGREE 0.0 | NEAR 2.033 | **FAR 252.967** |
| ImageCubeMapTexture | CubeMapTexturing | ok | AGREE 0.0 | **FAR 252.967** | NEAR 2.033 |
| ImageTexture | Texturing | ok | **FAR 202.162** | **FAR 163.544** | AGREE 1.645 |
| ImageTexture3D | Texturing3D | ok | **FAR 252.967** | **FAR 252.967** | NEAR 2.033 |
| IndexedFaceSet | Geometry3D | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| IndexedLineSet | Rendering | ok | AGREE 0.0 | **FAR 103.245** | NEAR 2.429 |
| IndexedQuadSet | CADGeometry | ok | AGREE 0.0 | **FAR 14.077** | AGREE 0.0 |
| IndexedTriangleFanSet | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| IndexedTriangleSet | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| IndexedTriangleStripSet | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| IsoSurfaceVolumeData | VolumeRendering | ok | AGREE 0.619 | AGREE 0.031 | **FAR 127.0** |
| LOD | Navigation | ok | AGREE 0.0 | **FAR 251.301** | NEAR 2.033 |
| Layer | Layering | ok | **FAR 15.126** | **FAR 18.107** | **FAR 100.556** |
| LayerSet | Layering | ok | **FAR 14.018** | **FAR 78.839** | **FAR 106.596** |
| Layout | Layout | ok | NEAR 2.516 | NEAR 2.501 | **FAR 75.355** |
| LayoutLayer | Layout | ok | NEAR 4.443 | NEAR 4.391 | **FAR 87.891** |
| LineProperties | Shape | ok | AGREE 0.0 | **FAR 76.996** | **FAR 14.184** |
| LineSet | Rendering | ok | AGREE 0.0 | **FAR 103.245** | NEAR 2.429 |
| LocalFog | EnvironmentalEffects | ok | AGREE 0.0 | AGREE 1.728 | **FAR 104.891** |
| Material | Shape | ok | AGREE 0.193 | AGREE 1.645 | AGREE 1.645 |
| Matrix3VertexAttribute | Shaders | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| Matrix4VertexAttribute | Shaders | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| MovieTexture | Texturing | ok | **FAR 202.162** | **no render** | AGREE 1.645 |
| MultiTexture | Texturing | ok | **FAR 135.23** | **FAR 101.452** | **FAR 135.312** |
| MultiTextureCoordinate | Texturing | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| MultiTextureTransform | Texturing | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| NavigationInfo | Navigation | ok | AGREE 0.0 | AGREE 0.855 | AGREE 0.889 |
| Normal | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| OpacityMapVolumeStyle | VolumeRendering | ok | AGREE 1.193 | AGREE 0.0 | **FAR 255.0** |
| OrthoViewpoint | Navigation | ok | AGREE 0.647 | AGREE 1.048 | **no render** |
| PackagedShader | Shaders | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| PhysicalMaterial | Shape | ok | **FAR 49.754** | **FAR 57.644** | AGREE 1.613 |
| PixelTexture | Texturing | ok | AGREE 0.193 | AGREE 0.548 | **FAR 17.002** |
| PixelTexture3D | Texturing3D | ok | **FAR 252.967** | **FAR 252.967** | NEAR 2.033 |
| PointLight | Lighting | ok | AGREE 0.222 | AGREE 1.095 | AGREE 0.209 |
| PointProperties | Shape | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| PointSet | Rendering | ok | AGREE 0.0 | **FAR 75.133** | **FAR 42.667** |
| Polyline2D | Geometry2D | ok | AGREE 0.0 | **FAR 93.14** | **FAR 127.379** |
| Polypoint2D | Geometry2D | ok | AGREE 0.0 | **FAR 99.056** | **FAR 76.8** |
| ProgramShader | Shaders | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| ProjectionVolumeStyle | VolumeRendering | ok | AGREE 1.193 | AGREE 0.0 | **FAR 255.0** |
| QuadSet | CADGeometry | ok | AGREE 0.0 | NEAR 4.848 | AGREE 0.0 |
| Rectangle2D | Geometry2D | ok | AGREE 0.0 | NEAR 4.848 | **FAR 250.152** |
| ScreenGroup | Layout | ok | AGREE 0.0 | AGREE 0.0 | **FAR 255.0** |
| SegmentedVolumeData | VolumeRendering | ok | AGREE 0.0 | AGREE 0.0 | **FAR 255.0** |
| ShadedVolumeStyle | VolumeRendering | ok | AGREE 0.0 | AGREE 0.0 | **FAR 147.0** |
| ShaderProgram | Shaders | ok | BLANK 0.0 | BLANK 0.0 | BLANK 0.0 |
| Shape | Shape | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| SilhouetteEnhancementVolumeStyle | VolumeRendering | ok | AGREE 1.193 | AGREE 0.0 | **FAR 255.0** |
| Sphere | Geometry3D | ok | AGREE 1.686 | NEAR 4.099 | NEAR 2.357 |
| SpotLight | Lighting | ok | AGREE 0.243 | AGREE 1.15 | AGREE 0.229 |
| StaticGroup | Grouping | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| Switch | Grouping | ok | AGREE 0.743 | AGREE 0.827 | AGREE 0.699 |
| Text | Text | ok | **FAR 28.44** | **FAR 177.174** | **FAR 178.841** |
| TextureBackground | EnvironmentalEffects | ok | **FAR 8.986** | **FAR 105.07** | **FAR 104.988** |
| TextureCoordinate | Texturing | ok | **FAR 192.128** | **FAR 156.924** | AGREE 0.0 |
| TextureCoordinate3D | Texturing3D | ok | AGREE 0.0 | NEAR 3.923 | **FAR 100.038** |
| TextureCoordinate4D | Texturing3D | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| TextureCoordinateGenerator | Texturing | ok | AGREE 0.28 | **FAR 68.0** | **FAR 104.23** |
| TextureProperties | Texturing | ok | **FAR 202.162** | **FAR 163.544** | AGREE 1.645 |
| TextureTransform | Texturing | ok | **FAR 202.162** | **FAR 163.511** | AGREE 1.645 |
| TextureTransform3D | Texturing3D | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| TextureTransformMatrix3D | Texturing3D | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| ToneMappedVolumeStyle | VolumeRendering | ok | AGREE 0.713 | AGREE 0.0 | **FAR 131.765** |
| Transform | Grouping | ok | AGREE 0.0 | NEAR 2.996 | AGREE 1.452 |
| TriangleFanSet | Rendering | ok | AGREE 0.0 | NEAR 4.617 | AGREE 0.0 |
| TriangleSet | Rendering | ok | AGREE 0.0 | **FAR 239.185** | AGREE 0.0 |
| TriangleSet2D | Geometry2D | ok | AGREE 0.0 | NEAR 4.617 | **FAR 240.852** |
| TriangleStripSet | Rendering | ok | AGREE 0.0 | **FAR 239.185** | AGREE 0.0 |
| TwoSidedMaterial | Shape | ok | AGREE 0.193 | AGREE 1.645 | AGREE 1.645 |
| UnlitMaterial | Shape | ok | AGREE 0.0 | NEAR 2.033 | NEAR 2.033 |
| Viewpoint | Navigation | ok | **FAR 13.697** | **FAR 13.696** | AGREE 0.393 |
| ViewpointGroup | Navigation | ok | **FAR 69.284** | AGREE 1.32 | **FAR 78.325** |
| Viewport | Layering | ok | NEAR 5.857 | NEAR 4.801 | **FAR 88.96** |
| VolumeData | VolumeRendering | ok | AGREE 0.0 | AGREE 0.0 | **FAR 255.0** |

X_ITE blank in 1 of 122 visible scenes.

| engine | AGREE | NEAR | FAR | BLANK | no render |
|---|---|---|---|---|---|
| three | 95 | 6 | 20 | 1 | 0 |
| babylon | 34 | 53 | 33 | 1 | 1 |
| wgpu | 38 | 30 | 52 | 1 | 1 |
