// src/v2/math-utils.ts
// Matrix math utilities for WebGPU (column-major format)

/**
 * Multiply two 4x4 matrices (column-major format for WebGPU)
 */
export function multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length !== 16 || b.length !== 16) {
    throw new Error('Invalid matrix size');
  }
  const out = new Float32Array(16);

  // WebGPU uses column-major storage, so both matrices are stored column-major
  // out[col*4 + row] = sum of (a[k*4 + row] * b[col*4 + k]) for k=0..3
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row]! * b[col * 4 + 0]! +
        a[1 * 4 + row]! * b[col * 4 + 1]! +
        a[2 * 4 + row]! * b[col * 4 + 2]! +
        a[3 * 4 + row]! * b[col * 4 + 3]!;
    }
  }
  return out;
}

/**
 * Create a transform matrix for position, scale, and rotation
 * Returns column-major matrix for WebGPU
 */
export function makeTransformMatrix(
  x: number, y: number, z: number,
  scale: number = 1, // TODO: xyz scaling
  _rotation: [number, number, number] = [0, 0, 0] // TODO: add rotation
): Float32Array {
  // Create column-major transform matrix for WebGPU
  return new Float32Array([
    scale, 0, 0, 0,     // column 0: [scale, 0, 0, 0]
    0, scale, 0, 0,     // column 1: [0, scale, 0, 0]
    0, 0, scale, 0,     // column 2: [0, 0, scale, 0]
    x, y, z, 1          // column 3: [x, y, z, 1] - translation
  ]);
}

/**
 * Create a perspective projection matrix (column-major for WebGPU)
 */
export function createPerspectiveMatrix(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);

  return new Float32Array([
    f / aspect, 0, 0, 0,                          // column 0
    0, f, 0, 0,                                   // column 1
    0, 0, -(far + near) / (far - near), -1,      // column 2
    0, 0, -(2 * near * far) / (far - near), 0    // column 3
  ]);
}

/**
 * Create an orthographic projection matrix (column-major for WebGPU)
 */
export function createOrthographicMatrix(left: number, right: number, top: number, bottom: number, near: number, far: number): Float32Array {
  const scaleX = 2 / (right - left);
  const scaleY = 2 / (top - bottom);
  const scaleZ = 1 / (far - near);
  const transX = -(right + left) / (right - left);
  const transY = -(top + bottom) / (top - bottom);
  const transZ = -near / (far - near);

  return new Float32Array([
    scaleX, 0,      0,     0,
    0,      scaleY, 0,     0,
    0,      0,      scaleZ,0,
    transX, transY, transZ,1
  ]);
}

/**
 * Create a lookAt view matrix (column-major for WebGPU)
 */
export function createLookAtMatrix(
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number]
): Float32Array {
  // Calculate forward vector (from eye to target)
  const forward: number[] = [
    target[0] - eye[0],
    target[1] - eye[1],
    target[2] - eye[2]
  ];
  const forwardLength = Math.sqrt(forward[0]! * forward[0]! + forward[1]! * forward[1]! + forward[2]! * forward[2]!);
  forward[0] = forward[0]! / forwardLength;
  forward[1] = forward[1]! / forwardLength;
  forward[2] = forward[2]! / forwardLength;

  // Calculate right vector (cross product of up and forward for correct handedness)
  const right: number[] = [
    up[1]! * forward[2] - up[2]! * forward[1],
    up[2]! * forward[0] - up[0]! * forward[2],
    up[0]! * forward[1] - up[1]! * forward[0]
  ];
  const rightLength = Math.sqrt(right[0]! * right[0]! + right[1]! * right[1]! + right[2]! * right[2]!);
  right[0] = right[0]! / rightLength;
  right[1] = right[1]! / rightLength;
  right[2] = right[2]! / rightLength;

  // Calculate true up vector (cross product of right and forward)
  const trueUp: number[] = [
    right[1]! * forward[2]! - right[2]! * forward[1]!,
    right[2]! * forward[0]! - right[0]! * forward[2]!,
    right[0]! * forward[1]! - right[1]! * forward[0]!
  ];

  // Create view matrix (column-major for WebGPU)
  return new Float32Array([
    right[0]!, -trueUp[0]!, -forward[0]!, 0,                                      // column 0
    right[1]!, -trueUp[1]!, -forward[1]!, 0,                                      // column 1
    right[2]!, -trueUp[2]!, -forward[2]!, 0,                                      // column 2
    -(right[0]! * eye[0] + right[1]! * eye[1] + right[2]! * eye[2]),            // column 3 x
    -(-trueUp[0]! * eye[0] + -trueUp[1]! * eye[1] + -trueUp[2]! * eye[2]),       // column 3 y
    -(-forward[0]! * eye[0] + -forward[1]! * eye[1] + -forward[2]! * eye[2]),   // column 3 z
    1                                                                             // column 3 w
  ]);
}
