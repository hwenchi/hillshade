# WebGPU Hillshade Renderer

**Live demo:** https://hwenchi.github.io/hillshade/

## Rhetorical Design

### Purpose

This project continues from [shortcut-to-graphics](https://github.com/hwenchi/shortcut-to-graphics), which implements Phong shading over a LiDAR DEM in Python. The initial implementation uses an explicit pixel loop, which is slow. Annotating the render loop with Numba's `@njit(parallel=True)` recovers performance through CPU parallelization — but the computation is embarrassingly parallel at the pixel level, and the natural endpoint of that observation is the GPU. This project reimplements the same hillshading computation as a WebGPU fragment shader, where every pixel executes simultaneously.

### Strategy

The same hillshading computation from the CPU version — normal estimation by finite differences and Phong shading — is reimplemented as a WebGPU fragment shader. The math is unchanged; only the execution model differs. Interactive sliders expose the light direction, vertical exaggeration, and the three Phong coefficients.

## Technical Challenges

### Neighbor sampling in texture space

In the CPU version, the stencil is expressed directly in pixel indices:

```math
\vec{n}[i,j] = \Bigl(f[i,j-1] - f[i,j+1],\; f[i+1,j] - f[i-1,j],\; 2\Bigr)^\top
```

In the fragment shader, the stencil must be expressed in texture coordinates $`(u, v) \in [0,1]^2`$ rather than pixel indices. A one-pixel offset translates to a step of $`1/\text{demSize}`$ in texture space, so sampling the neighbor one texel to the right means evaluating at $`(u + 1/\text{demSize},\; v)`$. Furthermore, the height values are in elevation units while the horizontal step corresponds to geographic distance — the two axes are on different scales. The `exaggeration` uniform scales the height axis to bring the normal into a visually meaningful range.