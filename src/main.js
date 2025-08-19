(function mainEntry() {
  // Initialize Matter.js
  const Engine = Matter.Engine,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Composite = Matter.Composite,
        Bodies = Matter.Bodies,
        Body = Matter.Body,
        Events = Matter.Events,
        Mouse = Matter.Mouse,
        MouseConstraint = Matter.MouseConstraint,
        Common = Matter.Common;

  // Create engine
  const engine = Engine.create({ enableSleeping: true });
  engine.positionIterations = 28;
  engine.velocityIterations = 25;
  engine.constraintIterations = 6;
  const world = engine.world;
  engine.gravity.y = 1.05;

  // Get the stage element
  const stage = document.getElementById('stage');
  if (!stage) {
    console.error('No element with id="stage" found.');
    return;
  }

  // Create SVG element
  const svgNS = "http://www.w3.org/2000/svg";
  let svg = stage.querySelector('svg#bean-stage-svg');
  if (!svg) {
    svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'bean-stage-svg';
    svg.style.display = 'block';
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.touchAction = 'none';
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    stage.appendChild(svg);
  }

  // Set SVG size
  const size = () => ({ w: Math.max(320, stage.clientWidth), h: Math.max(240, stage.clientHeight) });
  function setSVGSize() {
    const { w, h } = size();
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    // Also resize the mouse canvas
    const mouseCanvas = document.getElementById('mouse-canvas');
    if (mouseCanvas) {
      mouseCanvas.width = w;
      mouseCanvas.height = h;
    }
  }
  setSVGSize();

  // Coffee bean SVG
  const ART_CENTER_X = 150, ART_CENTER_Y = 150;
  const coffeeBeanSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="250" viewBox="0 0 200 250">
      <path d="M100 10 C150 10, 180 70, 180 125 C180 180, 150 240, 100 240
              C50 240, 20 180, 20 125 C20 70, 50 10, 100 10 Z"/>
      <path d="M100 30 C120 60, 80 90, 100 125 C120 160, 80 190, 100 220"/>
    </svg>`.trim();

  const EXTRA_LOWER_PERCENT = 0.01;
  const TARGET_BEAN_COUNT = 160;
  const BASE_MULT = 0.020;

  let walls = [];
  function addWalls() {
    const { w, h } = size();
    if (walls.length) {
      walls.forEach(b => Composite.remove(world, b));
      walls = [];
    }
    const thickness = 50;
    const staticOpts = { isStatic: true, friction: 0, restitution: 0 };
    const floorTop = h + Math.round(EXTRA_LOWER_PERCENT * h);
    const floorY = floorTop + thickness / 10;
    const topY = -thickness * 6;
    walls.push(
      Bodies.rectangle(w / 2, floorY, w + thickness * 2, thickness, staticOpts),
      Bodies.rectangle(w / 2, topY,   w + thickness * 2, thickness, staticOpts),
      Bodies.rectangle(-thickness / 2, h / 2, thickness, h, staticOpts),
      Bodies.rectangle(w + thickness / 2, h / 2, thickness, h, staticOpts)
    );
    Composite.add(world, walls);
  }
  addWalls();

  const bodyToBean = new Map();

  function beanSizeRange() {
    const { w } = size();
    const base = Math.max(8, Math.min(48, Math.round(w * BASE_MULT)));
    const min = Math.max(6, Math.round(base * 0.72));
    const max = Math.round(base * 1.08);
    return { min, max };
  }
  
  function dimsForWidth(beanW) {
    const originalW = 100, originalH = 125;
    const beanH = Math.round(beanW * (originalH / originalW));
    const scale = beanW / originalW;
    const radius = Math.max(Math.round(Math.max(beanW, beanH) * 0.5), 4);
    return { beanW, beanH, scale, radius };
  }

  function findFreePosition(xMin, xMax, y, radius, attempts = 12) {
    const bodies = Array.from(bodyToBean.keys());
    for (let attempt = 0; attempt < attempts; attempt++) {
      const x = Common.random(xMin, xMax);
      let ok = true;
      for (let other of bodies) {
        const op = other.position;
        const otherMeta = bodyToBean.get(other);
        if (!otherMeta) continue;
        const otherRadius = otherMeta.radius ||
          (Math.max(other.bounds.max.x - other.bounds.min.x, other.bounds.max.y - other.bounds.min.y) * 0.5);
        const dx = op.x - x;
        const dy = op.y - y;
        const dist2 = dx * dx + dy * dy;
        const minDist = (radius + otherRadius + 1.2);
        if (dist2 < minDist * minDist) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: Common.random(xMin, xMax), y };
  }

  function createBeanAt(x, y, forcedWidth = null) {
    const { min, max } = beanSizeRange();
    const beanW = forcedWidth != null ? forcedWidth : Math.round(Common.random(min, max));
    const { scale, radius } = dimsForWidth(beanW);
    const { w } = size();
    const leftMargin = Math.max(10, Math.round(beanW * 0.5));
    const rightMargin = w - leftMargin;
    const pos = findFreePosition(leftMargin, rightMargin, y, radius, 12);

    const density = 0.004 + (radius / 60) * 0.001;
    const body = Bodies.circle(pos.x, pos.y, radius, {
      friction: 0.95, 
      restitution: 0.01, 
      frictionAir: 0.02, 
      density, 
      sleepThreshold: 60,
      render: {
        fillStyle: '#ffffff',
        strokeStyle: '#000000',
        lineWidth: 1
      }
    }, 8);

    Body.setVelocity(body, { x: Common.random(-0.18, 0.18), y: Common.random(0.08, 0.4) });
    Body.setAngularVelocity(body, Common.random(-0.02, 0.02));
    Composite.add(world, body);

    const g = document.createElementNS(svgNS, 'g');
    g.classList.add('coffee-bean');
    try {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(coffeeBeanSVG, 'image/svg+xml');
      const root = parsed.documentElement;
      Array.from(root.childNodes).forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          g.appendChild(node.cloneNode(true));
        }
      });
    } catch (err) {
      g.innerHTML = coffeeBeanSVG;
    }
    g.style.pointerEvents = 'none';
    g.querySelectorAll('*').forEach(n => n.setAttribute('pointer-events', 'none'));
    svg.appendChild(g);

    const sx = Number(Common.random(0.92, 1.12).toFixed(3));
    const sy = Number(Common.random(0.88, 1.08).toFixed(3));
    const flip = (Common.random() > 0.88) ? -1 : 1;
    const finalScaleX = (sx * flip) * scale;
    const finalScaleY = (sy) * scale;

    const paths = g.querySelectorAll('path');
    paths.forEach((p, i) => {
      if (i === 0) {
        p.setAttribute('fill', '#ffffff');
        p.setAttribute('stroke', '#000000');
        p.setAttribute('stroke-width', String(Math.max(9, Math.round(11 * scale))));
      } else {
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#000000');
        p.setAttribute('stroke-width', String(Math.max(6.6, Math.round(5.6 * scale))));
        p.setAttribute('opacity', '0.98');
      }
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
    });

    bodyToBean.set(body, { el: g, scaleX: finalScaleX, scaleY: finalScaleY, radius, artCenterX: ART_CENTER_X, artCenterY: ART_CENTER_Y });
    return body;
  }

  function clearBeans() {
    bodyToBean.forEach((meta, body) => {
      if (meta.el?.parentNode) meta.el.parentNode.removeChild(meta.el);
      Composite.remove(world, body);
    });
    bodyToBean.clear();
  }

  let spawnTimer = null;
  function spawnFromTop(count = TARGET_BEAN_COUNT) {
    const { w, h } = size();
    const { min, max } = beanSizeRange();
    const topY = -Math.max(160, Math.round(h * 0.24));
    const leftMargin = Math.max(10, Math.round((min + max) / 2 * 0.5));
    const rightMargin = w - leftMargin;

    if (spawnTimer) clearInterval(spawnTimer);
    let spawned = 0;

    spawnTimer = setInterval(() => {
      const burst = 4;
      for (let i = 0; i < burst && spawned < count; i++) {
        const chosenW = Math.round(Common.random(min, max));
        createBeanAt(Common.random(leftMargin, rightMargin), topY, chosenW);
        spawned++;
      }
      if (spawned >= count) {
        clearInterval(spawnTimer);
        spawnTimer = null;
      }
    }, 80);
  }

  // Setup mouse interaction
  function setupMouseDrag() {
    const mouseCanvas = document.getElementById('mouse-canvas');
    if (!mouseCanvas) return null;
    
    // Create mouse
    const mouse = Mouse.create(mouseCanvas);
    mouse.pixelRatio = window.devicePixelRatio || 1;
    
    // Create mouse constraint
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });
    
    // Add mouse constraint to the world
    Composite.add(world, mouseConstraint);
    
    // Update mouse bounds on resize
    function updateMouseBounds() {
      const rect = mouseCanvas.getBoundingClientRect();
      try {
        Mouse.setOffset(mouse, { x: rect.left, y: rect.top });
      } catch (e) { }
      try {
        Mouse.setScale(mouse, { x: 1, y: 1 });
      } catch (e) { }
    }
    
    updateMouseBounds();
    window.addEventListener('resize', updateMouseBounds);
    
    // Handle drag events
    Events.on(mouseConstraint, 'startdrag', function(event) {
      const body = event.body;
      if (body) {
        Body.set(body, { frictionAir: 0.001 });
      }
    });

    Events.on(mouseConstraint, 'enddrag', function(event) {
      const body = event.body;
      if (body) {
        Body.set(body, { frictionAir: 0.02 });
        // Give the bean a little push when released
        Body.setVelocity(body, { 
          x: Common.random(-0.5, 0.5), 
          y: Common.random(-0.2, 0.2) 
        });
      }
    });
    
    return mouseConstraint;
  }

  let resizeTO = null;
  function handleResize() {
    setSVGSize();
    addWalls();
  }
  window.addEventListener('resize', () => {
    if (resizeTO) clearTimeout(resizeTO);
    resizeTO = setTimeout(handleResize, 160);
  });

  // Draw loop
  Events.on(engine, 'afterUpdate', () => {
    bodyToBean.forEach((meta, body) => {
      if (!body || !meta.el) return;
      
      const sx = meta.scaleX !== undefined ? meta.scaleX : (meta.scale || 1);
      const sy = meta.scaleY !== undefined ? meta.scaleY : (meta.scale || 1);
      meta.el.setAttribute(
        'transform',
        `translate(${body.position.x},${body.position.y}) rotate(${(body.angle * 180 / Math.PI).toFixed(3)}) scale(${sx}, ${sy}) translate(${-meta.artCenterX}, ${-meta.artCenterY})`
      );

      if (meta.el.parentNode !== svg) {
        svg.appendChild(meta.el);
      }
    });
  });

  // Initialize the simulation
  const runner = Runner.create();
  Runner.run(runner, engine);

  // Setup mouse interaction
  const mouseConstraint = setupMouseDrag();
  
  // Start spawning beans
  spawnFromTop();
  
  console.log("Coffee bean simulation started with mouse interaction");
})();
