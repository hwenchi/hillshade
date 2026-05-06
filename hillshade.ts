import shaderSrc from "./hillshade.wgsl";
import { createBuffer } from "./utils";
import demUrl from "./IL_Statewide_Lidar_DEM_WGS.png";

async function main() {
  const adapter = (await navigator.gpu.requestAdapter())!;
  const device = (await adapter.requestDevice())!;

  const canvas = document.querySelector("canvas")!;
  const context: GPUCanvasContext = canvas.getContext("webgpu")!;

  const demSize = 1024;
  canvas.width = canvas.height = window.innerHeight;

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format: presentationFormat, alphaMode: "premultiplied" });

  const renderTarget = device.createTexture({
    size: [canvas.width, canvas.height],
    format: presentationFormat,
    sampleCount: 4,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    sampleCount: 4,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const shaderModule = device.createShaderModule({ code: shaderSrc });
  const pipeline = device.createRenderPipeline({
    label: "hillshade",
    layout: "auto",
    vertex: {
      module: shaderModule,
      buffers: [
        {
          arrayStride: 2 * 4,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 2 * 4,
          attributes: [{ shaderLocation: 1, offset: 0, format: "float32x2" }],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
    multisample: {
      count: 4,
    },
  });

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const texture = device.createTexture({
    size: [demSize, demSize],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const res = await fetch(demUrl);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    { width: demSize, height: demSize }
  );

  const uniformValues = new Float32Array(6);
  const uniformBuffer = device.createBuffer({
    size: Math.max(24, uniformValues.byteLength),
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture.createView() },
      { binding: 2, resource: { buffer: uniformBuffer } },
    ],
  });

  const positions = new Float32Array([-1, 1, 1, 1, 1, -1, -1, -1]);
  const positionBuffer = createBuffer(device, positions, GPUBufferUsage.VERTEX);

  const texcoords = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const texcoordsBuffer = createBuffer(
    device,
    texcoords,
    GPUBufferUsage.VERTEX
  );

  const indices = new Uint16Array([0, 3, 1, 2, 1, 3]);
  const indicesBuffer = createBuffer(device, indices, GPUBufferUsage.INDEX);

  // uniforms
  const uniforms = {
    ambient: 0.2,
    diffuse: 0,
    specular: 1,
    exaggeration: 5,
    theta: 0,
    phi: 45,
  };

  const ambientInput = document.querySelector("#ambient")! as HTMLInputElement;
  ambientInput.value = String(uniforms.ambient);
  ambientInput.oninput = () => {
    uniforms.ambient = +ambientInput.value;
  };

  const diffuseInput = document.querySelector("#diffuse")! as HTMLInputElement;
  diffuseInput.value = String(uniforms.diffuse);
  diffuseInput.oninput = () => {
    uniforms.diffuse = +diffuseInput.value;
  };

  const specularInput = document.querySelector(
    "#specular"
  )! as HTMLInputElement;
  specularInput.value = String(uniforms.specular);
  specularInput.oninput = () => {
    uniforms.specular = +specularInput.value;
  };

  const exaggerationInput = document.querySelector(
    "#exaggeration"
  )! as HTMLInputElement;
  exaggerationInput.value = String(uniforms.exaggeration);
  exaggerationInput.oninput = () => {
    uniforms.exaggeration = +exaggerationInput.value;
  };

  const thetaInput = document.querySelector("#theta")! as HTMLInputElement;
  thetaInput.value = String(uniforms.theta);
  thetaInput.oninput = () => {
    uniforms.theta = +thetaInput.value;
  };

  const phiInput = document.querySelector("#phi")! as HTMLInputElement;
  phiInput.value = String(uniforms.phi);
  phiInput.oninput = () => {
    uniforms.phi = +phiInput.value;
  };

  function render() {
    uniformValues.set([
      uniforms.exaggeration,
      uniforms.theta,
      uniforms.phi,
      uniforms.ambient,
      uniforms.diffuse,
      uniforms.specular,
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, positionBuffer);
    passEncoder.setVertexBuffer(1, texcoordsBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, "uint16");
    passEncoder.drawIndexed(indices.length);
    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
