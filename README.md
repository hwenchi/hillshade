# WebGPU Hillshade Renderer

**Live demo:** https://galmungral.github.io/hillshade/

## Rhetorical Design

### Purpose

This project continues from [shortcut-to-graphics](https://github.com/GalMunGral/shortcut-to-graphics), which implements Phong shading over a LiDAR DEM in Python. The initial implementation uses an explicit pixel loop, which is slow. Annotating the render loop with Numba's `@njit(parallel=True)` recovers performance through CPU parallelization — but the computation is embarrassingly parallel at the pixel level, and the natural endpoint of that observation is the GPU. This project reimplements the same hillshading computation as a WebGPU fragment shader, where every pixel executes simultaneously.

### Strategy

The DEM is uploaded as a texture. The fragment shader samples neighboring texels to estimate the surface normal by central finite differences, then evaluates the Phong lighting equation. The math is unchanged from the CPU version; only the execution model differs. Interactive sliders expose the light direction (azimuth and elevation angle), vertical exaggeration, and the three Phong coefficients.

## Technical Challenges

### Neighbor sampling in texture space

In the fragment shader, the finite difference stencil samples the DEM at neighboring coordinates:

```math
\vec{n}[i,j] = \Bigl(f[i,j-1] - f[i,j+1],\; f[i+1,j] - f[i-1,j],\; 2\Bigr)^\top
```

But the shader operates in texture coordinates $`(u, v) \in [0, 1]^2`$, not pixel indices. Sampling one texel away requires a step of $`h = 1 / \text{demSize}`$ in texture space. Furthermore, the height values in the DEM are in elevation units while the horizontal step corresponds to a geographic distance — the two axes are on different scales. The `exaggeration` uniform scales the height axis to bring the normal into a visually meaningful range.