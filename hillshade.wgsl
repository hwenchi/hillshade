struct VSInput {
  @location(0) position: vec4f,
  @location(1) texcoord: vec2f,
};

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(1) texcoord: vec2f,
};

@vertex
fn vsMain(in: VSInput) -> VSOutput {
  var out: VSOutput;
  out.position = in.position;
  out.texcoord = in.texcoord;
  return out;
}

struct Uniforms {
  exaggeration: f32,
  theta: f32,
  phi: f32,
  ambient: f32,
  diffuse: f32,
  specular: f32,
};

@group(0) @binding(0) var uSampler: sampler;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn sample(texcoord: vec2f, dx: f32, dy: f32) -> f32 {
  return textureSampleLevel(uTexture, uSampler, texcoord + vec2f(dx, dy), 0.0).r;
}

const h = 0.001;

@fragment
fn fsMain(v: VSOutput) -> @location(0) vec4f {
  if (sample(v.texcoord, 0, 0) == 0.0) {
    return vec4f(0.0);
  }

  var N = normalize(vec3f(
    uniforms.exaggeration * (sample(v.texcoord, -h, 0) - sample(v.texcoord, h, 0)),
    uniforms.exaggeration * (sample(v.texcoord, 0, h) - sample(v.texcoord, 0, -h)),
    2
  ));
  var L = normalize(vec3f(
    cos(radians(uniforms.phi)) * cos(radians(uniforms.theta)),
    cos(radians(uniforms.phi)) * sin(radians(uniforms.theta)),
    sin(radians(uniforms.phi))
  ));
  var d = dot(L, N);

  var R = 2 * d * N - L;
  var V = vec3f(0, 0, 1);
  var s = dot(R, V);

  let intensity = uniforms.ambient + uniforms.diffuse * d + uniforms.specular * pow(s, 3);
  return vec4f(intensity, intensity, intensity, 1.0);
}