/* PointProperties (Shape level 4): pointSizeScaleFactor, pointSizeMinValue, pointSizeMaxValue and attenuation of a PointSet's points (19775-1 12.4.3). WebGPU has no point size, so a PointSet with
   PointProperties is drawn as camera-facing squares (body-br.js, the points block) whose size is clamp(scale / (a + b d + c d^2), min, max) pixels; a field change of it (or of the Material, Coordinate or Color) builds the points again (body-br.js, regeoPointSets). */
BR.node('PointProperties', { component: 'Shape', level: 4, container: 'pointProperties' });
