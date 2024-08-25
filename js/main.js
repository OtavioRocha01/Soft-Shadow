'use strict';

const vs = `#version 300 es
in vec4 a_position;
in vec2 a_texcoord;
in vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_textureMatrix;

out vec2 v_texcoord;
out vec4 v_projectedTexcoord;
out vec3 v_normal;

void main() {
  // Multiply the position by the matrix.
  vec4 worldPosition = u_world * a_position;

  gl_Position = u_projection * u_view * worldPosition;

  // Pass the texture coord to the fragment shader.
  v_texcoord = a_texcoord;

  v_projectedTexcoord = u_textureMatrix * worldPosition;

  // orient the normals and pass to the fragment shader
  v_normal = mat3(u_world) * a_normal;
}
`;

const fs = `#version 300 es
precision highp float;

in vec2 v_texcoord;
in vec4 v_projectedTexcoord;
in vec3 v_normal;

uniform vec4 u_colorMult;
uniform sampler2D u_texture;
uniform sampler2D u_projectedTexture;
uniform vec3 u_reverseLightDirection;
uniform int u_samples; // uniform para o número de amostras

out vec4 outColor;

const float texelSize = 1.0 / 512.0;
const float bias = - 0.05;

void main() {
  vec3 normal = normalize(v_normal);
  float light = dot(normal, u_reverseLightDirection);

  vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
  float currentDepth = projectedTexcoord.z + bias;

  bool inRange =
      projectedTexcoord.x >= 0.0 &&
      projectedTexcoord.x <= 1.0 &&
      projectedTexcoord.y >= 0.0 &&
      projectedTexcoord.y <= 1.0;

  float shadowLight = 0.0;
  if (inRange) {
    for (int x = -u_samples; x <= u_samples; ++x) {
      for (int y = -u_samples; y <= u_samples; ++y) {
        vec2 offset = vec2(float(x), float(y)) * texelSize;
        float projectedDepth = texture(u_projectedTexture, projectedTexcoord.xy + offset).r;
        shadowLight += projectedDepth <= currentDepth ? 0.0 : 1.0;
      }
    }
    shadowLight /= float((u_samples * 2 + 1) * (u_samples * 2 + 1));
  } else {
    shadowLight = 1.0;
  }

  vec4 texColor = texture(u_texture, v_texcoord) * u_colorMult;
  outColor = vec4(
      texColor.rgb * light * shadowLight,
      texColor.a);
}`;

const colorVS = `#version 300 es
in vec4 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;

void main() {
  // Multiply the position by the matrices.
  gl_Position = u_projection * u_view * u_world * a_position;
  }
  `;
  
const colorFS = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 outColor;

void main() {
  outColor = u_color;
  }
  `;
  
  function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector('#canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
    return;
  }
  
  var rotateButton = document.getElementById("rotateCamera");

  rotateButton.onclick = function() {
    if (cameraRotation == 0) {
      cameraRotation = 0.01;
    } else {
      cameraRotation = 0;
    }
  };
  
  const sampleValue = document.getElementById("sampleValue");
  document.getElementById("sampleSlider").addEventListener("input", function() {
    sampleValue.textContent = this.value;
    settings.samples = parseInt(this.value);
  })
  
  const programOptions = {
    attribLocations: {
      'a_position': 0,
      'a_normal':   1,
      'a_texcoord': 2,
    },
  };
  const textureProgramInfo = twgl.createProgramInfo(gl, [vs, fs], programOptions);
  const colorProgramInfo = twgl.createProgramInfo(gl, [colorVS, colorFS], programOptions);

  twgl.setAttributePrefix("a_");

  let cameraAngle = 0;
  let cameraRotation = 0;

  const sphereBufferInfo = twgl.primitives.createSphereBufferInfo(
      gl,
      1.4,  // radius
      32, // subdivisions around
      24, // subdivisions down
  );
  const sphereVAO = twgl.createVAOFromBufferInfo(
      gl, textureProgramInfo, sphereBufferInfo);
  const planeBufferInfo = twgl.primitives.createPlaneBufferInfo(
      gl,
      20,  // width
      20,  // height
      1,   // subdivisions across
      1,   // subdivisions down
  );
  const planeVAO = twgl.createVAOFromBufferInfo(
      gl, textureProgramInfo, planeBufferInfo);
  const cubeBufferInfo = twgl.primitives.createCubeBufferInfo(
      gl,
      1.5,  // size
  );
  const cubeVAO = twgl.createVAOFromBufferInfo(
      gl, textureProgramInfo, cubeBufferInfo);
  const cubeLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, {
    position: [
      -1, -1, -1,
       1, -1, -1,
      -1,  1, -1,
       1,  1, -1,
      -1, -1,  1,
       1, -1,  1,
      -1,  1,  1,
       1,  1,  1,
    ],
    indices: [
      0, 1,
      1, 3,
      3, 2,
      2, 0,

      4, 5,
      5, 7,
      7, 6,
      6, 4,

      0, 4,
      1, 5,
      3, 7,
      2, 6,
    ],
  });
  const cubeLinesVAO = twgl.createVAOFromBufferInfo(
      gl, colorProgramInfo, cubeLinesBufferInfo);

  // make a 8x8 checkerboard texture
  const checkerboardTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, checkerboardTexture);
  gl.texImage2D(
      gl.TEXTURE_2D,
      0,                // mip level
      gl.LUMINANCE,     // internal format
      8,                // width
      8,                // height
      0,                // border
      gl.LUMINANCE,     // format
      gl.UNSIGNED_BYTE, // type
      new Uint8Array([  // data
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
        0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC,
        0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF, 0xCC, 0xFF,
      ]));
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const depthTexture = gl.createTexture();
  const depthTextureSize = 512;
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
      gl.TEXTURE_2D,      // target
      0,                  // mip level
      gl.DEPTH_COMPONENT32F, // internal format
      depthTextureSize,   // width
      depthTextureSize,   // height
      0,                  // border
      gl.DEPTH_COMPONENT, // format
      gl.FLOAT,           // type
      null);              // data
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const depthFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
  gl.framebufferTexture2D(
      gl.FRAMEBUFFER,       // target
      gl.DEPTH_ATTACHMENT,  // attachment point
      gl.TEXTURE_2D,        // texture target
      depthTexture,         // texture
      0);                   // mip level

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  const settings = {
    posX: 2.5,
    posY: 4.8,
    posZ: 7,
    targetX: 3.5,
    targetY: 0,
    targetZ: 3.5,
    projWidth: 10,
    projHeight: 10,
    samples: 4,
  };
  

  const fieldOfViewRadians = degToRad(60);

  const planeUniforms = {
    u_colorMult: [0.5, 0.5, 1, 1],  // lightblue
    u_color: [1, 0, 0, 1],
    u_texture: checkerboardTexture,
    u_world: m4.translation(0, 0, 0),
  };
  const sphereUniforms = {
    u_colorMult: [1, 0.5, 0.5, 1],  // pink
    u_color: [0, 0, 1, 1],
    u_texture: checkerboardTexture,
    u_world: m4.translation(2, 3, 4),
  };
  const cubeUniformsArray = [
    {
      u_colorMult: [0.7, 0.7, 0.7, 1],  // lightgray
      u_color: [0, 0, 1, 1],
      u_texture: checkerboardTexture,
      u_world: m4.translation(3, .8, 1.4),
    },
    {
      u_colorMult: [0.7, 0.7, 0.7, 1],  // lighgray
      u_color: [0, 0, 1, 1],
      u_texture: checkerboardTexture,
      u_world: m4.translation(1.2, .8, -1.4),
    },
    {
      u_colorMult: [0.7, 0.7, 0.7, 1],  // lightgray
      u_color: [0, 0, 1, 1],
      u_texture: checkerboardTexture,
      u_world: m4.translation(-.5, .8, 3),
    },
  ];

  function drawScene(
      projectionMatrix,
      cameraMatrix,
      textureMatrix,
      lightWorldMatrix,
      programInfo) {
    
    const viewMatrix = m4.inverse(cameraMatrix);

    gl.useProgram(programInfo.program);


    twgl.setUniforms(programInfo, {
      u_view: viewMatrix,
      u_projection: projectionMatrix,
      u_textureMatrix: textureMatrix,
      u_projectedTexture: depthTexture,
      u_reverseLightDirection: lightWorldMatrix.slice(8, 11),
      u_samples: settings.samples
    });

    // ------ Draw the sphere --------
    gl.bindVertexArray(sphereVAO);
    twgl.setUniforms(programInfo, sphereUniforms);
    twgl.drawBufferInfo(gl, sphereBufferInfo);

    // ------ Draw the cubes --------
    gl.bindVertexArray(cubeVAO);
    cubeUniformsArray.forEach((cubeUniforms) => {
      twgl.setUniforms(programInfo, cubeUniforms);
      twgl.drawBufferInfo(gl, cubeBufferInfo);
    });

    // ------ Draw the plane --------
    gl.bindVertexArray(planeVAO);
    twgl.setUniforms(programInfo, planeUniforms);
    twgl.drawBufferInfo(gl, planeBufferInfo);
  }

  function render() {
    twgl.resizeCanvasToDisplaySize(gl.canvas);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    const lightWorldMatrix = m4.lookAt(
        [settings.posX, settings.posY, settings.posZ],          // position
        [settings.targetX, settings.targetY, settings.targetZ], // target
        [0, 1, 0],                                              // up
    );
    const lightProjectionMatrix = m4.orthographic(
            -settings.projWidth / 2,   // left
             settings.projWidth / 2,   // right
            -settings.projHeight / 2,  // bottom
             settings.projHeight / 2,  // top
             0.5,                      // near
             10);                      // far

    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.viewport(0, 0, depthTextureSize, depthTextureSize);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawScene(
        lightProjectionMatrix,
        lightWorldMatrix,
        m4.identity(),
        lightWorldMatrix,
        colorProgramInfo);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.2, 0.45, 0.8, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    cameraAngle += cameraRotation;

    const radius = 15;
    const cameraPosition = [
      Math.cos(cameraAngle) * radius,
      12, 
      Math.sin(cameraAngle) * radius 
    ];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const cameraMatrix = m4.lookAt(cameraPosition, target, up);


    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.scale(textureMatrix, 0.5, 0.5, 0.5);
    textureMatrix = m4.multiply(textureMatrix, lightProjectionMatrix);
    
    textureMatrix = m4.multiply(
        textureMatrix,
        m4.inverse(lightWorldMatrix));

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix =
        m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    drawScene(
        projectionMatrix,
        cameraMatrix,
        textureMatrix,
        lightWorldMatrix,
        textureProgramInfo);
  
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
