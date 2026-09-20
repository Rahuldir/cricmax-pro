/* ============================================================
   CricMax Pro — Post-Processing FX
   Bloom, vignette, chromatic aberration, film grain
   Uses custom shader pass (no external libs needed)
   Exposes: window.CricMaxPostFX
   Usage:
     const fx = CricMaxPostFX.build(renderer, scene, camera);
     fx.render(); // call instead of renderer.render(scene, camera)
     fx.setIntensity({ bloom: 0.8, vignette: 0.4 });
   ============================================================ */
(function(){
  'use strict';

  function build(renderer, scene, camera){
    const handle = {};
    const W = renderer.domElement.width;
    const H = renderer.domElement.height;

    /* ---------------- RENDER TARGET ---------------- */
    const rt = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    /* ---------------- BLOOM HELPERS ---------------- */
    const brightPassMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: 0.85 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float lum = max(c.r, max(c.g, c.b));
          float k = smoothstep(threshold, threshold + 0.15, lum);
          gl_FragColor = vec4(c * k, 1.0);
        }`
    });

    const blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        direction: { value: new THREE.Vector2(1.0 / W, 0) },
        kernelRadius: { value: 2.5 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 direction;
        uniform float kernelRadius;
        varying vec2 vUv;
        void main(){
          vec4 sum = vec4(0.0);
          float total = 0.0;
          for (float i = -8.0; i <= 8.0; i += 1.0){
            float w = exp(-(i*i) / (2.0 * kernelRadius * kernelRadius));
            sum += texture2D(tDiffuse, vUv + direction * i) * w;
            total += w;
          }
          gl_FragColor = sum / total;
        }`
    });

    const compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: 0.85 },
        vignette: { value: 0.35 },
        grainAmount: { value: 0.05 },
        aberration: { value: 1.4 },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float bloomStrength;
        uniform float vignette;
        uniform float grainAmount;
        uniform float aberration;
        uniform float time;
        varying vec2 vUv;

        float rand(vec2 co){
          return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main(){
          vec2 uv = vUv;
          vec2 center = uv - 0.5;
          float dist = length(center);

          // Chromatic aberration — radial shift
          vec2 offset = center * dist * 0.006 * aberration;
          vec3 sceneCol;
          sceneCol.r = texture2D(tScene, uv + offset).r;
          sceneCol.g = texture2D(tScene, uv).g;
          sceneCol.b = texture2D(tScene, uv - offset).b;

          // Bloom add
          vec3 bloom = texture2D(tBloom, uv).rgb;
          vec3 col = sceneCol + bloom * bloomStrength;

          // Vignette
          float vig = 1.0 - smoothstep(0.55, 1.05, dist * 1.6) * vignette;
          col *= vig;

          // Film grain
          float g = (rand(uv + time) - 0.5) * grainAmount;
          col += g;

          gl_FragColor = vec4(col, 1.0);
        }`
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const brightPassScene = new THREE.Scene();
    const brightPassQuad = new THREE.Mesh(quadGeo, brightPassMat);
    brightPassScene.add(brightPassQuad);

    const blurSceneH = new THREE.Scene();
    const blurQuadH = new THREE.Mesh(quadGeo, blurMat.clone());
    blurSceneH.add(blurQuadH);

    const blurSceneV = new THREE.Scene();
    const blurQuadV = new THREE.Mesh(quadGeo, blurMat.clone());
    blurSceneV.add(blurQuadV);

    const compositeScene = new THREE.Scene();
    const compositeQuad = new THREE.Mesh(quadGeo, compositeMat);
    compositeScene.add(compositeQuad);

    /* ---------------- BLOOM RENDER TARGETS ---------------- */
    const halfW = Math.floor(W / 4);
    const halfH = Math.floor(H / 4);
    const brightRT = new THREE.WebGLRenderTarget(halfW, halfH, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const blurRT_A = new THREE.WebGLRenderTarget(halfW, halfH, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const blurRT_B = new THREE.WebGLRenderTarget(halfW, halfH, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

    /* ---------------- PUBLIC API ---------------- */
    handle.setIntensity = function(opts){
      if (opts.bloom !== undefined) compositeMat.uniforms.bloomStrength.value = opts.bloom;
      if (opts.vignette !== undefined) compositeMat.uniforms.vignette.value = opts.vignette;
      if (opts.grain !== undefined) compositeMat.uniforms.grainAmount.value = opts.grain;
      if (opts.aberration !== undefined) compositeMat.uniforms.aberration.value = opts.aberration;
    };

    handle.update = function(elapsed){
      compositeMat.uniforms.time.value = elapsed;
    };

    handle.render = function(){
      const oldTarget = renderer.getRenderTarget();

      // 1. Render scene to RT
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, camera);

      // 2. Bright pass → brightRT (downsampled)
      brightPassMat.uniforms.tDiffuse.value = rt.texture;
      renderer.setRenderTarget(brightRT);
      renderer.clear();
      renderer.render(brightPassScene, quadCamera);

      // 3. Blur horizontal → blurRT_A
      blurQuadH.material.uniforms.tDiffuse.value = brightRT.texture;
      blurQuadH.material.uniforms.direction.value.set(1 / halfW, 0);
      renderer.setRenderTarget(blurRT_A);
      renderer.clear();
      renderer.render(blurSceneH, quadCamera);

      // 4. Blur vertical → blurRT_B
      blurQuadV.material.uniforms.tDiffuse.value = blurRT_A.texture;
      blurQuadV.material.uniforms.direction.value.set(0, 1 / halfH);
      renderer.setRenderTarget(blurRT_B);
      renderer.clear();
      renderer.render(blurSceneV, quadCamera);

      // 5. Composite to screen
      compositeMat.uniforms.tScene.value = rt.texture;
      compositeMat.uniforms.tBloom.value = blurRT_B.texture;
      renderer.setRenderTarget(oldTarget);
      renderer.clear();
      renderer.render(compositeScene, quadCamera);
    };

    handle.dispose = function(){
      rt.dispose(); brightRT.dispose(); blurRT_A.dispose(); blurRT_B.dispose();
      brightPassMat.dispose(); blurMat.dispose(); compositeMat.dispose();
      quadGeo.dispose();
    };

    console.log('🎥 Post-FX built (bloom + vignette + grain + aberration)');
    return handle;
  }

  window.CricMaxPostFX = { build };
})();
