/* ============================================================
   CricMax Pro — Environment Renderer
   Sky dome, clouds, sun/moon, atmospheric scattering, stars
   Exposes: window.CricMaxEnvironment
   Usage:
     const env = CricMaxEnvironment.build(scene, renderer);
     env.setTimeOfDay('night');  // 'day' | 'sunset' | 'night'
     env.update(dt, elapsed);
   ============================================================ */
(function(){
  'use strict';

  function texCanvas(w, h, draw){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  /* ------------------------------------------------------------
     SKY DOME — large inverted sphere with gradient shader
     ------------------------------------------------------------ */
  function buildSkyDome(){
    const uniforms = {
      topColor:    { value: new THREE.Color(0x020713) },
      midColor:    { value: new THREE.Color(0x0a1e3a) },
      bottomColor: { value: new THREE.Color(0x000308) },
      offset:      { value: 100 },
      exponent:    { value: 0.6 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main(){
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main(){
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          vec3 sky = mix(bottomColor, midColor, smoothstep(0.0, 0.5, t));
          sky = mix(sky, topColor, smoothstep(0.5, 1.0, t));
          gl_FragColor = vec4(sky, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 32), mat);
    dome.renderOrder = -1;
    return { mesh: dome, uniforms };
  }

  /* ------------------------------------------------------------
     CLOUD LAYER — soft billboard clouds in the sky
     ------------------------------------------------------------ */
  function buildClouds(scene){
    const cloudGroup = new THREE.Group();
    cloudGroup.position.y = 60;

    const cloudTex = texCanvas(256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      // 6 radial puffs
      for (let i = 0; i < 6; i++){
        const x = 40 + Math.random() * (w - 80);
        const y = 30 + Math.random() * (h - 60);
        const r = 30 + Math.random() * 30;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.65)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    });

    for (let i = 0; i < 14; i++){
      const cloudMat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.4 + Math.random() * 0.3,
        depthWrite: false,
        fog: false
      });
      const sprite = new THREE.Sprite(cloudMat);
      const ang = (i / 14) * Math.PI * 2;
      const r = 80 + Math.random() * 60;
      sprite.position.set(Math.cos(ang) * r, Math.random() * 30, Math.sin(ang) * r);
      const sc = 40 + Math.random() * 40;
      sprite.scale.set(sc, sc * 0.55, 1);
      sprite.userData.driftSpeed = 0.15 + Math.random() * 0.25;
      sprite.userData.startX = sprite.position.x;
      cloudGroup.add(sprite);
    }
    scene.add(cloudGroup);
    return cloudGroup;
  }

  /* ------------------------------------------------------------
     STARS — tiny bright dots visible at night
     ------------------------------------------------------------ */
  function buildStars(scene){
    const geo = new THREE.BufferGeometry();
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++){
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 350;
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = Math.abs(r * Math.cos(phi)) + 10;
      positions[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      sizes[i] = 0.5 + Math.random() * 2.2;
      const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.15, 0.4, 0.85 + Math.random() * 0.15);
      colors[i*3]   = c.r;
      colors[i*3+1] = c.g;
      colors[i*3+2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = 1;
    scene.add(stars);
    return { mesh: stars, mat };
  }

  /* ------------------------------------------------------------
     MOON — glowing disc for night
     ------------------------------------------------------------ */
  function buildMoon(scene){
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf0f4ff,
      transparent: true,
      opacity: 0,
      fog: false
    });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(8, 32), mat);
    moon.position.set(-100, 150, -300);
    moon.lookAt(0, 20, 0);
    scene.add(moon);
    // Halo
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x88aaff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(20, 32), haloMat);
    halo.position.copy(moon.position);
    halo.lookAt(0, 20, 0);
    scene.add(halo);
    return { mesh: moon, halo, mat, haloMat };
  }

  /* ------------------------------------------------------------
     PUBLIC: BUILD + UPDATE
     ------------------------------------------------------------ */
  function build(scene, renderer){
    const handles = {};
    handles.skyDome   = buildSkyDome();
    scene.add(handles.skyDome.mesh);
    handles.clouds    = buildClouds(scene);
    handles.stars     = buildStars(scene);
    handles.moon      = buildMoon(scene);
    handles.time      = 0;
    handles.mode      = 'night';

    handles.setTimeOfDay = function(mode){
      handles.mode = mode;
      const u = handles.skyDome.uniforms;
      if (mode === 'day'){
        u.topColor.value.setHex(0x0a3a6a);
        u.midColor.value.setHex(0x3f89c9);
        u.bottomColor.value.setHex(0x9ec7e8);
        handles.clouds.children.forEach(c => c.material.opacity = 0.65);
        handles.stars.mat.opacity = 0;
        handles.moon.mat.opacity = 0;
        handles.moon.haloMat.opacity = 0;
      } else if (mode === 'sunset'){
        u.topColor.value.setHex(0x1a0f3a);
        u.midColor.value.setHex(0xd4562b);
        u.bottomColor.value.setHex(0xfba574);
        handles.clouds.children.forEach(c => c.material.opacity = 0.55);
        handles.stars.mat.opacity = 0.15;
        handles.moon.mat.opacity = 0.35;
        handles.moon.haloMat.opacity = 0.2;
      } else {
        u.topColor.value.setHex(0x000208);
        u.midColor.value.setHex(0x050d24);
        u.bottomColor.value.setHex(0x0a1e3a);
        handles.clouds.children.forEach(c => c.material.opacity = 0.15);
        handles.stars.mat.opacity = 0.85;
        handles.moon.mat.opacity = 0.95;
        handles.moon.haloMat.opacity = 0.4;
      }
    };
    handles.setTimeOfDay('night');

    handles.update = function(dt, elapsed){
      // Cloud drift
      handles.clouds.children.forEach(c => {
        c.position.x += c.userData.driftSpeed * dt;
        if (c.position.x > 140) c.position.x = -140;
      });
      // Star twinkle
      if (handles.stars.mat.opacity > 0.05){
        handles.stars.mesh.rotation.y = elapsed * 0.005;
      }
    };

    console.log('🌌 Environment built');
    return handles;
  }

  window.CricMaxEnvironment = { build };
})();
