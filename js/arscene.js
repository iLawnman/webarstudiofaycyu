// js/scene.js

export class ARScene {
  constructor(ui) {
    this.ui = ui;
    this.canvas = document.createElement('canvas');
    document.body.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl', { xrCompatible: true });
    if (!this.gl) {
      this.ui.log('WebGL не поддерживается', 'err');
    }

    this.program = null;
    this.floorVao = null;
    this.floorVertexCount = 0;
    
    this.initGL();
  }

  initGL() {
    const gl = this.gl;

    // Шейдеры (Simple Projection + ModelView Matrix)
    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aColor;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uModelMatrix;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);

    this.attribs = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      color: gl.getAttribLocation(this.program, 'aColor')
    };

    this.uniforms = {
      projectionMatrix: gl.getUniformLocation(this.program, 'uProjectionMatrix'),
      viewMatrix: gl.getUniformLocation(this.program, 'uViewMatrix'),
      modelMatrix: gl.getUniformLocation(this.program, 'uModelMatrix')
    };

    this.setupFloorBuffer();
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      this.ui.log('Shader error: ' + gl.getShaderInfoLog(shader), 'err');
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  setupFloorBuffer() {
    const gl = this.gl;
    const lines = [];
    const size = 10;
    const step = 1;

    // Сетка пола (на уровне Y = 0 локально, смещение зададим через Model Matrix Y = -1)
    for (let i = -size; i <= size; i += step) {
      // Линии вдоль Z
      lines.push(i, 0, -size,  0, 1, 0);
      lines.push(i, 0,  size,  0, 1, 0);
      // Линии вдоль X
      lines.push(-size, 0, i,  0, 1, 0);
      lines.push( size, 0, i,  0, 1, 0);
    }

    this.floorVertexCount = lines.length / 6;

    this.floorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
  }

  renderView(projectionMatrix, viewMatrix) {
    const gl = this.gl;

    gl.useProgram(this.program);

    gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, viewMatrix);

    // Матрица трансформации пола — **ОПУСКАЕМ ПОЛ НА Y = -1.0**
    const floorModelMatrix = new Float32Array([
      1,  0,  0, 0,
      0,  1,  0, 0,
      0,  0,  1, 0,
      0, -1,  0, 1  // Translation Y = -1.0
    ]);

    gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, floorModelMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.floorBuffer);
    
    // Position Attribute
    gl.enableVertexAttribArray(this.attribs.position);
    gl.vertexAttribPointer(this.attribs.position, 3, gl.FLOAT, false, 24, 0);
    
    // Color Attribute
    gl.enableVertexAttribArray(this.attribs.color);
    gl.vertexAttribPointer(this.attribs.color, 3, gl.FLOAT, false, 24, 12);

    gl.drawArrays(gl.LINES, 0, this.floorVertexCount);
  }
}