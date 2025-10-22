// tests/math-utils.test.ts
// Unit tests for math utilities

import {
    multiplyMat4,
    makeTransformMatrix,
    createPerspectiveMatrix,
    createOrthographicMatrix,
    createLookAtMatrix
} from '../src/utils/math-utils';

describe('Math Utils', () => {
    describe('multiplyMat4', () => {
        test('should multiply two identity matrices', () => {
            const identity = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ]);

            const result = multiplyMat4(identity, identity);

            expect(result).toEqual(identity);
        });

        test('should multiply translation matrices correctly', () => {
            const translateX = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                5, 0, 0, 1
            ]);
            const translateY = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 3, 0, 1
            ]);

            const result = multiplyMat4(translateX, translateY);

            // Result should have combined translation
            expect(result[12]).toBeCloseTo(5); // x
            expect(result[13]).toBeCloseTo(3); // y
            expect(result[14]).toBeCloseTo(0); // z
            expect(result[15]).toBeCloseTo(1); // w
        });

        test('should throw error for invalid first matrix size', () => {
            const invalidMatrix = new Float32Array(12); // Wrong size
            const validMatrix = new Float32Array(16);

            expect(() => {
                multiplyMat4(invalidMatrix, validMatrix);
            }).toThrow('Invalid matrix size');
        });

        test('should throw error for invalid second matrix size', () => {
            const validMatrix = new Float32Array(16);
            const invalidMatrix = new Float32Array(8); // Wrong size

            expect(() => {
                multiplyMat4(validMatrix, invalidMatrix);
            }).toThrow('Invalid matrix size');
        });

        test('should throw error when both matrices are invalid size', () => {
            const invalidMatrix1 = new Float32Array(10);
            const invalidMatrix2 = new Float32Array(20);

            expect(() => {
                multiplyMat4(invalidMatrix1, invalidMatrix2);
            }).toThrow('Invalid matrix size');
        });
    });

    describe('makeTransformMatrix', () => {
        test('should create identity matrix with no parameters', () => {
            const matrix = makeTransformMatrix();

            // Check diagonal is 1 (identity)
            expect(matrix[0]).toBeCloseTo(1);  // m00
            expect(matrix[5]).toBeCloseTo(1);  // m11
            expect(matrix[10]).toBeCloseTo(1); // m22
            expect(matrix[15]).toBeCloseTo(1); // m33

            // Check translation is zero
            expect(matrix[12]).toBeCloseTo(0); // tx
            expect(matrix[13]).toBeCloseTo(0); // ty
            expect(matrix[14]).toBeCloseTo(0); // tz
        });

        test('should create translation matrix', () => {
            const matrix = makeTransformMatrix([5, 10, -3]);

            // Check translation values (column 3)
            expect(matrix[12]).toBeCloseTo(5);   // x
            expect(matrix[13]).toBeCloseTo(10);  // y
            expect(matrix[14]).toBeCloseTo(-3);  // z
            expect(matrix[15]).toBeCloseTo(1);   // w
        });

        test('should create uniform scale matrix', () => {
            const matrix = makeTransformMatrix([0, 0, 0], 2);

            // For uniform scale of 2, diagonal should be 2 (except w=1)
            expect(matrix[0]).toBeCloseTo(2);  // m00
            expect(matrix[5]).toBeCloseTo(2);  // m11
            expect(matrix[10]).toBeCloseTo(2); // m22
            expect(matrix[15]).toBeCloseTo(1); // m33
        });

        test('should create non-uniform scale matrix', () => {
            const matrix = makeTransformMatrix([0, 0, 0], [2, 3, 4]);

            // Check scale is applied correctly
            expect(matrix[0]).toBeCloseTo(2);  // m00
            expect(matrix[5]).toBeCloseTo(3);  // m11
            expect(matrix[10]).toBeCloseTo(4); // m22
        });

        test('should create rotation matrix around Y axis', () => {
            const halfPi = Math.PI / 2;
            const matrix = makeTransformMatrix([0, 0, 0], 1, [0, halfPi, 0]);

            // 90 degree rotation around Y should swap X and Z
            expect(matrix[0]).toBeCloseTo(0);   // m00 (cos(90) = 0)
            expect(matrix[10]).toBeCloseTo(0);  // m22
            expect(Math.abs(matrix[8]!)).toBeCloseTo(1); // m20 or m02
        });

        test('should combine translation, rotation, and scale', () => {
            const matrix = makeTransformMatrix([1, 2, 3], [2, 2, 2], [0, Math.PI / 4, 0]);

            // Check translation is preserved
            expect(matrix[12]).toBeCloseTo(1); // x
            expect(matrix[13]).toBeCloseTo(2); // y
            expect(matrix[14]).toBeCloseTo(3); // z

            // Matrix should not be identity
            expect(matrix[0]).not.toBeCloseTo(1);
        });
    });

    describe('createPerspectiveMatrix', () => {
        test('should create perspective projection matrix', () => {
            const fov = Math.PI / 4; // 45 degrees
            const aspect = 16 / 9;
            const near = 0.1;
            const far = 100;

            const matrix = createPerspectiveMatrix(fov, aspect, near, far);

            expect(matrix.length).toBe(16);
            expect(matrix[15]).toBeCloseTo(0); // Perspective projection has w=0 in bottom-right
            expect(matrix[11]).toBeCloseTo(-1); // Perspective projection marker
        });

        test('should handle different aspect ratios', () => {
            const fov = Math.PI / 3;
            const aspect1 = 1; // Square
            const aspect2 = 2; // Wide

            const matrix1 = createPerspectiveMatrix(fov, aspect1, 0.1, 100);
            const matrix2 = createPerspectiveMatrix(fov, aspect2, 0.1, 100);

            // X scaling should be different
            expect(matrix1[0]!).not.toBeCloseTo(matrix2[0]!);
        });

        test('should handle narrow field of view', () => {
            const fov = Math.PI / 8; // 22.5 degrees
            const matrix = createPerspectiveMatrix(fov, 1.0, 0.1, 100);

            // Narrower FOV should have larger scale values
            expect(Math.abs(matrix[0]!)).toBeGreaterThan(1);
        });
    });

    describe('createOrthographicMatrix', () => {
        test('should create orthographic projection matrix', () => {
            const left = -10;
            const right = 10;
            const top = 10;
            const bottom = -10;
            const near = 0.1;
            const far = 100;

            const matrix = createOrthographicMatrix(left, right, top, bottom, near, far);

            expect(matrix.length).toBe(16);
            expect(matrix[15]).toBeCloseTo(1); // Orthographic has w=1
        });

        test('should handle asymmetric bounds', () => {
            const matrix = createOrthographicMatrix(-5, 15, 8, -12, 0.1, 50);

            expect(matrix.length).toBe(16);
            expect(matrix[15]).toBeCloseTo(1);

            // Scale X should be 2 / (right - left) = 2 / 20 = 0.1
            expect(matrix[0]).toBeCloseTo(0.1);

            // Scale Y should be 2 / (top - bottom) = 2 / 20 = 0.1
            expect(matrix[5]).toBeCloseTo(0.1);
        });

        test('should handle square viewport', () => {
            const matrix = createOrthographicMatrix(-1, 1, 1, -1, 0.1, 100);

            // Square viewport: scale X and Y should be the same
            expect(matrix[0]).toBeCloseTo(1); // 2 / (1 - (-1)) = 1
            expect(matrix[5]).toBeCloseTo(1); // 2 / (1 - (-1)) = 1
        });

        test('should handle wide viewport', () => {
            const matrix = createOrthographicMatrix(-20, 20, 10, -10, 1, 1000);

            // Wide viewport (40 wide, 20 tall)
            expect(matrix[0]).toBeCloseTo(0.05); // 2 / 40
            expect(matrix[5]).toBeCloseTo(0.1);  // 2 / 20
        });

        test('should compute correct translation values', () => {
            const matrix = createOrthographicMatrix(-10, 10, 10, -10, 0.1, 100);

            // For symmetric bounds, translation should be 0
            expect(matrix[12]).toBeCloseTo(0); // transX
            expect(matrix[13]).toBeCloseTo(0); // transY
        });

        test('should handle depth range correctly', () => {
            const near = 1;
            const far = 100;
            const matrix = createOrthographicMatrix(-1, 1, 1, -1, near, far);

            // scaleZ should be 1 / (far - near)
            expect(matrix[10]).toBeCloseTo(1 / (far - near));

            // transZ should be -near / (far - near)
            expect(matrix[14]).toBeCloseTo(-near / (far - near));
        });
    });

    describe('createLookAtMatrix', () => {
        test('should create lookAt matrix looking down -Z axis', () => {
            const eye: [number, number, number] = [0, 0, 5];
            const target: [number, number, number] = [0, 0, 0];
            const up: [number, number, number] = [0, 1, 0];

            const matrix = createLookAtMatrix(eye, target, up);

            expect(matrix.length).toBe(16);
            expect(matrix[15]).toBeCloseTo(1); // w component
        });

        test('should create lookAt matrix from different positions', () => {
            const eye: [number, number, number] = [5, 5, 5];
            const target: [number, number, number] = [0, 0, 0];
            const up: [number, number, number] = [0, 1, 0];

            const matrix = createLookAtMatrix(eye, target, up);

            // Matrix should be orthonormal (rotation + translation)
            expect(matrix[15]).toBeCloseTo(1);
        });

        test('should create lookAt matrix looking along X axis', () => {
            const eye: [number, number, number] = [10, 0, 0];
            const target: [number, number, number] = [0, 0, 0];
            const up: [number, number, number] = [0, 1, 0];

            const matrix = createLookAtMatrix(eye, target, up);

            expect(matrix.length).toBe(16);
            expect(matrix[15]).toBeCloseTo(1);
        });

        test('should create lookAt matrix with elevated camera', () => {
            const eye: [number, number, number] = [0, 10, 10];
            const target: [number, number, number] = [0, 0, 0];
            const up: [number, number, number] = [0, 1, 0];

            const matrix = createLookAtMatrix(eye, target, up);

            expect(matrix[15]).toBeCloseTo(1);
        });
    });
});
