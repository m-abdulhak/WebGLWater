/*
 * WebGL Water
 * http://madebyevan.com/webgl-water/
 *
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */

 /*
 * Modified by Mohammed Abdullhak
 * All modifications can be found under comments starting with "Modified for:"
 * All modifications can be seen @ https://github.com/m-abdulhak/WebGLWater
 */

function text2html(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function handleError(text) {
  var html = text2html(text);
  if (html == 'WebGL not supported') {
    html = 'Your browser does not support WebGL.<br>Please see\
    <a href="http://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">\
    Getting a WebGL Implementation</a>.';
  }
  var loading = document.getElementById('loading');
  loading.innerHTML = html;
  loading.style.zIndex = 1;
}

window.onerror = handleError;

// Modified for: changing starting camera angles
var gl = GL.create();
var water;
var cubemap;
var renderer;
var angleX = -35;
var angleY = 45;

// Sphere physics info
// Modified for: enabling physics by default
var useSpherePhysics = true;
var center;
var oldCenter;
var velocity;
var gravity;
var radius;
var paused = false;
// Modified for: Add option to show/hide ceiling
var hideCeiling = 1;


// Modified for: Add camera position and zoom level control keys; added variabled for camera positions.
var cameraX = 0;
var cameraY = 0;
var cameraZ = -4;
// Modified for: Add option to change ball color; added new variables to store ball color options
var sphereColor = new GL.Vector(255.0, 128.0, 0.0);
var sphereColorAuto = true;
// Modified for: Add option to change water color; added new variables to store water color options
var abovewaterColor = new GL.Vector(2.0, 2.0, 2.0);
var underwaterColor = new GL.Vector(2.0, 2.0, 2.0);

// Modified for: Add option to change ball color; added new function to change color
// Modified for: Add option to change water color; added new function to change color
function changeColor() {
  var newVal = document.getElementById('ball-color').value;
  if(newVal == "auto"){
    sphereColorAuto = true;
  } else{
    sphereColorAuto = false;
    var newColor = hexToRgb(newVal);
    sphereColor = new GL.Vector(newColor[0], newColor[1], newColor[2]);
  }
  var newWaterVal = document.getElementById('water-color').value;
  if(newWaterVal == "auto"){
    abovewaterColor = new GL.Vector(0.25, 1.0, 1.25);
    underwaterColor = new GL.Vector(0.4, 0.9, 1.0);
  } else if(newWaterVal == "black"){
    abovewaterColor = new GL.Vector(0.1, .1, .1);
    underwaterColor = new GL.Vector(0.3, 0.3, .3);
  } else{
    var newWaterColor = hexToRgb(newWaterVal);
    abovewaterColor = new GL.Vector(newWaterColor[0], newWaterColor[1], newWaterColor[2]);
    underwaterColor = new GL.Vector(newWaterColor[0]/2, newWaterColor[1]/2, newWaterColor[2]/2);
  }
}

// Modified for: Add option to change ball and water color; added new function to convert from hex to float vector colors
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseFloat(parseInt(result[1], 16)),parseFloat(parseInt(result[2], 16)),parseFloat(parseInt(result[3], 16))]: null;
}

window.onload = function() {
  var ratio = window.devicePixelRatio || 1;
  var help = document.getElementById('help');

  function onresize() {
    var width = innerWidth - help.clientWidth - 20;
    var height = innerHeight;
    gl.canvas.width = width * ratio;
    gl.canvas.height = height * ratio;
    gl.canvas.style.width = width + 'px';
    gl.canvas.style.height = height + 'px';
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.matrixMode(gl.PROJECTION);
    gl.loadIdentity();
    // Modified for: Changing field of view
    gl.perspective(60, gl.canvas.width / gl.canvas.height, 0.01, 100);
    gl.matrixMode(gl.MODELVIEW);
    draw();
  }

  document.body.appendChild(gl.canvas);
  gl.clearColor(0, 0, 0, 1);

  water = new Water();
  renderer = new Renderer();
  cubemap = new Cubemap({
    xneg: document.getElementById('xneg'),
    xpos: document.getElementById('xpos'),
    yneg: document.getElementById('ypos'),
    ypos: document.getElementById('ypos'),
    zneg: document.getElementById('zneg'),
    zpos: document.getElementById('zpos')
  });

  if (!water.textureA.canDrawTo() || !water.textureB.canDrawTo()) {
    throw new Error('Rendering to floating-point textures is required but not supported');
  }

  // Modified for: changing starting position and ball size
  center = oldCenter = new GL.Vector(0.0, 1.5, 0.0);
  velocity = new GL.Vector(1,-1,1);
  gravity = new GL.Vector(0, -5, 0);
  radius = 0.35;

  for (var i = 0; i < 20; i++) {
    water.addDrop(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.03, (i & 1) ? 0.01 : -0.01);
  }

  document.getElementById('loading').innerHTML = '';
  onresize();

  var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function(callback) { setTimeout(callback, 0); };

  var prevTime = new Date().getTime();
  function animate() {
    var nextTime = new Date().getTime();
    if (!paused) {
      update((nextTime - prevTime) / 1000);
      draw();
    }
    prevTime = nextTime;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  window.onresize = onresize;

  var prevHit;
  var planeNormal;
  var mode = -1;
  var MODE_ADD_DROPS = 0;
  var MODE_MOVE_SPHERE = 1;
  var MODE_ORBIT_CAMERA = 2;

  var oldX, oldY;

  function startDrag(x, y) {
    oldX = x;
    oldY = y;
    var tracer = new GL.Raytracer();
    var ray = tracer.getRayForPixel(x * ratio, y * ratio);
    var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
    var sphereHitTest = GL.Raytracer.hitTestSphere(tracer.eye, ray, center, radius);
    if (sphereHitTest) {
      mode = MODE_MOVE_SPHERE;
      prevHit = sphereHitTest.hit;
      planeNormal = tracer.getRayForPixel(gl.canvas.width / 2, gl.canvas.height / 2).negative();
    } else if (Math.abs(pointOnPlane.x) < 1 && Math.abs(pointOnPlane.z) < 1) {
      mode = MODE_ADD_DROPS;
      duringDrag(x, y);
    } else {
      mode = MODE_ORBIT_CAMERA;
    }
  }

  function duringDrag(x, y) {
    switch (mode) {
      case MODE_ADD_DROPS: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var pointOnPlane = tracer.eye.add(ray.multiply(-tracer.eye.y / ray.y));
        water.addDrop(pointOnPlane.x, pointOnPlane.z, 0.03, 0.01);
        if (paused) {
          water.updateNormals();
          renderer.updateCaustics(water);
        }
        break;
      }
      case MODE_MOVE_SPHERE: {
        var tracer = new GL.Raytracer();
        var ray = tracer.getRayForPixel(x * ratio, y * ratio);
        var t = -planeNormal.dot(tracer.eye.subtract(prevHit)) / planeNormal.dot(ray);
        var nextHit = tracer.eye.add(ray.multiply(t));
        center = center.add(nextHit.subtract(prevHit));
        center.x = Math.max(radius - 1, Math.min(1 - radius, center.x));
        // Modified for: Add intersection test for sphere at pool height to prevent ball from
        // going heigher than pool
        center.y = Math.max(radius - 1, Math.min(2 - radius, center.y));
        center.z = Math.max(radius - 1, Math.min(1 - radius, center.z));
        prevHit = nextHit;
        if (paused) renderer.updateCaustics(water);
        break;
      }
      case MODE_ORBIT_CAMERA: {
        angleY -= x - oldX;
        angleX -= y - oldY;
        angleX = Math.max(-89.999, Math.min(89.999, angleX));
        break;
      }
    }
    oldX = x;
    oldY = y;
    if (paused) draw();
  }

  function stopDrag() {
    mode = -1;
  }

  function isHelpElement(element) {
    return element === help || element.parentNode && isHelpElement(element.parentNode);
  }

  document.onmousedown = function(e) {
    if (!isHelpElement(e.target)) {
      e.preventDefault();
      startDrag(e.pageX, e.pageY);
    }
  };

  document.onmousemove = function(e) {
    duringDrag(e.pageX, e.pageY);
  };

  document.onmouseup = function() {
    stopDrag();
  };

  document.ontouchstart = function(e) {
    if (e.touches.length === 1 && !isHelpElement(e.target)) {
      e.preventDefault();
      startDrag(e.touches[0].pageX, e.touches[0].pageY);
    }
  };

  document.ontouchmove = function(e) {
    if (e.touches.length === 1) {
      duringDrag(e.touches[0].pageX, e.touches[0].pageY);
    }
  };

  document.ontouchend = function(e) {
    if (e.touches.length == 0) {
      stopDrag();
    }
  };

  document.onkeydown = function(e) {
    if (e.which == ' '.charCodeAt(0)) paused = !paused;
    else if (e.which == 'G'.charCodeAt(0)) useSpherePhysics = !useSpherePhysics;
    else if (e.which == 'L'.charCodeAt(0) && paused) draw();
    // Modified for: Add interaction, pressing R key resets sphere position and velocity      
    else if (e.which == 'R'.charCodeAt(0)){
      center = oldCenter = new GL.Vector(0, 1.5, 0);
      velocity = new GL.Vector(Math.random(0,2)-1,-1,Math.random(0,2)-1);
    }
    // Modified for: Add camera position and zoom level control keys.
    else if (e.which == 'Z'.charCodeAt(0)){
      cameraZ = Math.min(0,cameraZ+0.25);
    }
    else if (e.which == 'X'.charCodeAt(0)){
      cameraZ = Math.min(0,cameraZ-0.25);
    }
    else if (e.which == 'A'.charCodeAt(0)){
      cameraX = cameraX+0.25;
    }
    else if (e.which == 'D'.charCodeAt(0)){
      cameraX = cameraX-0.25;
    }
    else if (e.which == 'S'.charCodeAt(0)){
      cameraY = cameraY+0.25;
    }
    else if (e.which == 'W'.charCodeAt(0)){
      cameraY = cameraY-0.25;
    }
    // Modified for: Add option to show/hide ceiling
    else if (e.which == 'H'.charCodeAt(0)){
      hideCeiling = !hideCeiling;
      renderer = new Renderer();
    }
    // Modified for: Add option to change ball size
    else if (e.which == '0'.charCodeAt(0)){
      radius = Math.min(1,radius+.01);
    }
    // Modified for: Add option to change ball size
    else if (e.which == '9'.charCodeAt(0)){
      radius = Math.max(.01,radius-.01);
    }
    // Modified for: Add option to change ball speed
    else if (e.which == 'P'.charCodeAt(0)){
      velocity.x = velocity.x*10;
      velocity.y = velocity.y*10;
      velocity.z = velocity.z*10;
    }
    // Modified for: Add option to change ball speed
    else if (e.which == 'O'.charCodeAt(0)){
      velocity.x = velocity.x/10;
      velocity.y = velocity.y/10;
      velocity.z = velocity.z/10;
    };
  };

  var frame = 0;

  function update(seconds) {
    if (seconds > 1) return;
    frame += seconds * 2;

    if (mode == MODE_MOVE_SPHERE) {
      // Start from rest when the player releases the mouse after moving the sphere
      velocity = new GL.Vector();
    } else if (useSpherePhysics) {
      // Fall down with viscosity under water
      var percentUnderWater = Math.max(0, Math.min(1, (radius - center.y) / (2 * radius)));
      velocity = velocity.add(gravity.multiply(seconds - 1.1 * seconds * percentUnderWater));
      velocity = velocity.subtract(velocity.unit().multiply(percentUnderWater * seconds * velocity.dot(velocity)));
      center = center.add(velocity.multiply(seconds));

      // Bounce off the bottom
      // Modified for: changing physiscs behavior and adding bouncing off walls and ceiling
      if (center.y < radius - 1) {
        center.y = radius - 1;
        velocity.y = Math.abs(velocity.y) * 5;
        velocity.x = velocity.x + Math.random(0,10)-5;
        velocity.z = velocity.z + Math.random(0,10)-5;
      }
      if (center.y + radius>2) {
        center.y = 2-radius;
        velocity.y = -velocity.y*4;
      }
      if(center.x+radius>1){
        center.x = 1-radius;
        velocity.x = -velocity.x;
      }
      if(center.x-radius<-1){
        center.x = -1+radius;
        velocity.x = -velocity.x;
      }
      if(center.z+radius>1){
        center.z = 1-radius;
        velocity.z = -velocity.z;
      }
      if(center.z-radius<-1){
        center.z = -1+radius;
        velocity.z = -velocity.z;
      }
      // Modified for: Add option to change ball speed
      velocity.x = Math.min(300,velocity.x);
      velocity.y = Math.min(300,velocity.y);
      velocity.z = Math.min(300,velocity.z);
    }

    // Displace water around the sphere
    water.moveSphere(oldCenter, center, radius);
    oldCenter = center;

    // Update the water simulation and graphics
    water.stepSimulation();
    water.stepSimulation();
    water.updateNormals();
    renderer.updateCaustics(water);
  }

  function draw() {
    // Change the light direction to the camera look vector when the L key is pressed
    //if (GL.keys.L) {
    //  renderer.lightDir = GL.Vector.fromAngles((90 - angleY) * Math.PI / 180, -angleX * Math.PI / 180);
    //  if (paused) renderer.updateCaustics(water);
    //} 
    // Modified for: Change light direction according to current camera position 
    renderer.lightDir = GL.Vector.fromAngles((90 - angleY) * Math.PI / 180, -angleX * Math.PI / 180);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    // Modified for: Add camera position and zoom level control keys.
    gl.translate(cameraX, cameraY, cameraZ);
    gl.rotate(-angleX, 1, 0, 0);
    gl.rotate(-angleY, 0, 1, 0);
    gl.translate(0, 0.5, 0);

    gl.enable(gl.DEPTH_TEST);
    renderer.sphereCenter = center;
    renderer.sphereRadius = radius;
    // Modified for: Add option to change ball color; pass color options variables to renderer
    renderer.sphereColor = (typeof(sphereColor)!=undefined&& sphereColor)?sphereColor:new GL.Vector(255.0, 0.0, 0.0);
    renderer.sphereColorAuto = sphereColorAuto | false;
    // Modified for: Add option to change water color; pass color options variables to renderer
    renderer.abovewaterColor = (typeof(abovewaterColor)!=undefined&& abovewaterColor)?abovewaterColor:new GL.Vector(0.25, 1.0, 1.25);
    renderer.underwaterColor = (typeof(underwaterColor)!=undefined&& underwaterColor)?underwaterColor:new GL.Vector(0.4, 0.9, 1.0);
    renderer.renderCube();
    renderer.renderWater(water, cubemap);
    renderer.renderSphere();
    gl.disable(gl.DEPTH_TEST);
  }
};