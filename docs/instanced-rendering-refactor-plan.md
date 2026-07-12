# Renderer & engine cleanup + instanced-rendering foundation

## Context

This project is an investigation into WASM (Zig) + WebGPU: a Zig core computes physics/transforms,
and WebGPU renders the results. The original hope — zero-copy shared buffers from WASM to the GPU —
proved impossible (WebGPU cannot map WASM linear memory as a GPU buffer). That lesson stands and is
fine. The right success metric is **"one bulk copy + zero per-frame allocation + one draw call per
mesh"**, not "zero-copy".

Before layering new features (assets/materials, lighting) onto the engine, we want a **stability &
cleanup pass** that also fixes the one real rendering performance bug and lays a data-model foundation
that keeps two future workloads open:

- an **animated crowd** (~100×100 soldiers, same mesh, each with its own "march" state), and
- a **vegetation landscape** (5–30 species meshes, each cloned in decent numbers, with tint/wind/LOD/
  alpha textures/culling).

**Scope of this plan:** land **Stage A (stability & cleanup)** and **Stage B (instanced-rendering
foundation)** as a sequence of small, individually shippable increments. **Stage C** (vegetation,
animation, GPU culling) is designed-for and left unblocked, not built now.

**Guiding principle:** each increment below is sized to be a single focused PR — one concern, its own
`npm run verify` green, and a visual check where rendering is touched. Prefer merging small over batching.

## Current state (updated 2026-07-11)

Most of **Stage A** landed — but via the separate **A3 scene-first engine API** effort
(`docs/a3-scene-first-engine-api-plan.md`), not as the increments below. (Naming collision warning:
"A3" *there* is the whole scene-first refactor; "A3" *here* is just the chicken-and-egg increment.)

- ✅ **A1** dead render code removed. ✅ **A2** single per-frame `gameObject.update()`.
- ✅ **A3 (chicken-and-egg)** + ✅ **A4 (mesh-registration order)** — fixed by the scene-first refactor:
  registration is one deterministic pass at `Engine.loadScene`/`Scene.mount`, and meshes are registered
  from the scene tree there, so setup is no longer order-fragile.
- ✅ **B0 (topology into the registry)** — done in PR #10: draw pass now comes from each mesh's render
  mode via `MeshRegistry`, killing the hard-coded name lists.
- ✅ **A6** camera unified (`CameraComponent` single source) **and** v1 browser-snapshot parity
  confirmed — the Playwright snapshots pass against the original references.
- ◑ **A5** is the only Stage A item left: bridge TODOs still open (`wasm-physics-bridge.ts:35` vec3
  getter, `:179` material id, `:318` kinematic-state).
- Also since this plan was written: the `Engine` gained restart/scene-switch lifecycle (PR #11), and the
  `Engine`-owns-the-runtime refactor landed (PR #14) — the `Engine` now owns the renderer + physics
  bridge and drives `tick()` (components → physics → render), so **A3 is complete**. This is the clean
  base Stage B builds on: B3/B8 (kill the per-frame hot loop, trim the sync round-trip) now touch the
  Engine's `render()`/`tick()`, not a Scene method.

**Not started: Stage B proper (B1–B8)** — the instanced-rendering perf refactor (bind-once atlas,
bucket-aware removal, per-mesh draw table, storage-buffer instances, widened structs, lighting). This is
the remaining substance of this plan.

## Why cleanup before the perf refactor

The stability fixes and the perf refactor touch the **same files** (`scene-system.ts`,
`webgpu.renderer.ts`, `wasm-physics-bridge.ts`, `game_engine.zig`). Doing the perf refactor on top of a
fragile scene lifecycle means rewriting that code twice. So Stage A goes first and leaves the lifecycle
correct; Stage B then rewrites the buffer/draw path on solid ground.

---

## Stage A — Stability & cleanup (do first)

These are small, mostly behavior-preserving increments. Each is independent; they can land in any order,
but A2/A3 are the ones that matter most for a correct lifecycle.

### A1 — Delete dead render code
Remove the commented-out legacy fallback `render()` and the commented `renderFromWasmBuffers` call now
that the WASM path (`this.renderer.render(wasmModule)`) is the live one.
- **Files:** `src/engine/scene-system.ts` (:237 commented call, :243+ commented legacy `render()`).
- **Done when:** dead block gone, `npm run verify` green, scenes still render identically.

### A2 — Fix the double per-frame GameObject update
`Scene.update()` iterates all entities and calls `gameObject.update(deltaTime)` **twice** (once at
`:182-185` before physics, once at `:191-194` after). If step 4 only exists to let `RigidBody` sync
transforms back from WASM, that should be an explicit `syncFromWasm()` pass — not a second full
`update()` that re-runs user component logic (and doubles any force/input applied in `update`).
- **Files:** `src/engine/scene-system.ts` (:177-201), `src/engine/components.ts` (RigidBody sync),
  `src/engine/gameobject.ts`.
- **Done when:** each component's `update()` runs once per frame; RigidBody still reflects WASM results;
  input-driven scenes behave identically (no doubled forces). Add/adjust a test asserting single update.

### A3 — Fix the chicken-and-egg entity registration
`addGameObject()` attempts to register with WASM before the bridge is initialized, then
`registerEntitiesWithWasm()` re-registers *everything* at `init()`. Make registration have a single,
well-defined trigger: either (a) `addGameObject` queues and registers lazily once the bridge is ready,
or (b) registration only happens in `init()`/after and `addGameObject` never attempts it early. Remove
the "tried to register before WASM was ready" workaround.
- **Files:** `src/engine/scene-system.ts` (`addGameObject`, `registerEntitiesWithWasm` :287-303, `init`
  :138-150), `src/engine/wasm-physics-bridge.ts`.
- **Done when:** no double-registration path; adding a GameObject before *or* after `init()` both work;
  test covering both orderings.

### A4 — Fix the mesh-registration ordering requirement
Today meshes **must** be registered on the renderer before `scene.init()`, or entities can't find their
meshes (documented in `GAME_ENGINE_PLAN.md` TODO and `webgpu-refactor-plan.md`). Make mesh lookup
tolerant of registration order (resolve mesh IDs lazily at first render, or validate + clear-error at
`init`), so scene setup isn't order-fragile.
- **Files:** `src/renderer/mesh-registry.ts`, `src/renderer/webgpu.renderer.ts`,
  `src/engine/scene-system.ts`.
- **Done when:** registering a mesh after `scene.init()` either works or fails with a clear diagnostic,
  not a silent wrong-mesh render.

### A5 — Triage the bridge TODOs
Three real TODOs in `wasm-physics-bridge.ts`: (`:35`) getters returning scalars instead of a vec3;
(`:179`) hard-coded `material ID = 0` — belongs to the future asset/material phase, leave a tracked note;
(`:318`) unimplemented WASM kinematic-state update. Resolve the cheap ones (vec3 getter), and convert the
rest into clearly-scoped, referenced TODOs (kinematic state → its own increment; material ID → Phase 9).
- **Files:** `src/engine/wasm-physics-bridge.ts`.
- **Done when:** no ambiguous TODOs; each remaining one names its owning phase/increment.

### A6 — Camera/perspective parity with v1 snapshots ✅ DONE
`GAME_ENGINE_PLAN.md` TODO: "sort out camera and perspective to match original v1 snapshots in browser
tests." Reconcile the view/projection math so `browser-tests` snapshots match v1.
- **Files:** camera in `src/engine/scene-system.ts` / camera module, `src/renderer/webgpu.renderer.ts`,
  `browser-tests/`.
- **Done:** camera unified onto `CameraComponent` (single view/projection source); the `browser-tests`
  Playwright snapshots pass against the original v1 references.

**Stage A exit criteria:** `npm run verify` green (38+ tests), scene lifecycle has single-update +
single-registration + order-independent meshes, no dead render code, browser snapshots green.

---

## Stage B — Instanced-rendering foundation

This is the original salvage/perf work, re-cut into smaller increments. The design (below) is unchanged;
the ordering is finer-grained so each step is independently verifiable.

### The real performance bug (verified against code)
- The WASM→GPU copy is **not** the problem: `gpu-buffer-manager.ts:80-117` already does one bulk
  `writeBuffer` of a dense, contiguous 80-byte/instance block (~960 KB/frame at 10k instances). Correct
  and cheap.
- The bug is `webgpu.renderer.ts:487-524`: every frame, per mesh group, per pass, it re-reads metadata
  per entity, allocates a JS `Float32Array`, copies each entity's 20 floats, and **creates a fresh
  `GPUBuffer` with `mappedAtCreation`** — then GCs it. Buffer creation in the hot loop is the cardinal
  WebGPU sin. It does this because same-mesh entities are **not contiguous** in the WASM array, so it
  re-groups on the CPU each frame.
- Root cause of non-contiguity: `remove_entity` (`game_engine.zig:1204`) is an O(1) **swap-remove** that
  moves the global last entity into the hole — landing an arbitrary mesh into another mesh's range.

**Reframing for the crowd worry:** an army where every soldier has its own march state is *still*
instanced rendering. Per-soldier variation moves into **per-instance data** (an animation time/phase)
plus a baked-animation approach. Instancing scales to the crowd; the only thing that must change is
making per-instance data *extensible* and the draw path *allocation-free*.

### B0 — Topology into the mesh registry
Move triangle-list vs line-list into the mesh registry; kill the hard-coded name lists
(`webgpu.renderer.ts:441-443`).
- **Done when:** no mesh-name string matching for topology; registry is the single source.

### B1 — Bind the geometry atlas once
Keep the shared vertex + shared index buffers, but **bind them once** and select geometry via
`drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance)` instead of rebinding
buffers with byte offsets (`webgpu.renderer.ts:481-485`). Keep indices **mesh-relative (0-based)** so
`baseVertex` works and uint16 (65,535 verts) limits a single mesh, not the atlas.
- **Done when:** buffers bound once per pass; per-mesh geometry selected via base offsets; scenes render
  identically.

### B2 — Bucket-aware removal in WASM
Replace the global swap-remove with a **bucket-aware** removal: swap the removed entity with the *last
element of its own mesh bucket* and adjust bucket boundaries (or re-bucket per frame). This is the main
new data-structure work.
- **Files:** `src/core/game_engine.zig` (:1204 removal, bucket bookkeeping).
- **Done when:** a Zig test asserts bucket contiguity holds after mixed add/remove sequences.

### B3 — Per-mesh draw table + kill the hot loop
Build `{ firstIndex, indexCount, baseVertex, firstInstance, instanceCount, topology }` per mesh from the
(now contiguous) bucket metadata; issue one `drawIndexed(…, firstInstance)` per mesh. Delete
`renderWasmInstancesByMode`'s per-frame regrouping and **every per-frame `createBuffer`**. One bulk
`writeBuffer` for instances.
- **Files:** `src/renderer/webgpu.renderer.ts` (:487-524), `src/renderer/gpu-buffer-manager.ts`, add a
  draw-table export in `game_engine.zig` (:1248 offset exports).
- **Done when:** instrumented frame shows **zero `createBuffer` per frame** and one draw call per distinct
  mesh; the 1000-instance safety cap (`webgpu.renderer.ts:393`) can be lifted without regression.

### B4 — `extern struct` layout + offset asserts (prerequisite for storage buffers)
Convert GPU-mapped Zig structs to `extern struct` with explicit padding. The current hard-coded metadata
offset read (`webgpu.renderer.ts:330-345`) is fragile because plain Zig structs have no layout guarantee.
- **Files:** `src/core/game_engine.zig` (`RenderingComponent`/`EntityMetadata` :78-93).
- **Done when:** Zig test asserts field offsets; layout is guaranteed, not incidental.

### B5 — Instance data → storage buffer
Move per-instance data from a vertex stream to a `var<storage, read>` buffer indexed by
`instanceData[instance_index]` (`instance_index` includes `firstInstance`, so no remapping). Storage
buffers are extensible, compute-readable (future culling), and support the later redirection scheme.
- **Files:** `src/renderer/webgpu.renderer.ts` (bind group + shader), `src/renderer/gpu-buffer-manager.ts`
  (:80-117 becomes a single storage-buffer write).
- **Done when:** instance data reaches the GPU as a storage buffer; temporarily tinting by
  `instance_index` shows correct per-mesh ordering.

### B6 — Widen the instance struct to 96 B
Widen `RenderingComponent` (`game_engine.zig:78`) to the extensible 96 B `extern struct` (std430,
16-byte alignment, stride 96 → 10k × 96 = 960 KB) so future workloads don't force a re-layout:

```
model              mat4x4<f32>   // 64 B @ 0
color              vec4<f32>     // 16 B @ 64   tint/rgba
anim_time          f32           //  4 B @ 80   march/wind/VAT time  — WASM-written each frame
variant_tex_index  u32           //  4 B @ 84   set at spawn
lod_flags          u32           //  4 B @ 88   lod (low bits) + flags (high bits)
bone_palette_off   u32           //  4 B @ 92   reserved for future GPU skinning; unused for now
```

- **Done when:** Zig test asserts `sizeof == 96` with the field offsets above; still one contiguous
  `writeBuffer`.

### B7 — Widen the vertex format + basic lighting
Add normals/uvs so materials/lighting/skinning don't force a later re-layout of the shared vertex buffer,
and add basic lambert lighting to prove the plumbing.
- Stream 0 (always): `position vec3 @0` + `normal vec3 @12` + `uv vec2 @24`, stride 32.
- Stream 1 (skinned pipelines only, future): `joints uint16x4 @0` + `weights unorm16x4 @8`, stride 16.
- **Files:** `src/renderer/mesh-registry.ts` (:3 `MeshData` gains normals/uv), `src/renderer/mesh-utils.ts`
  (generators emit normals/uv), `src/renderer/webgpu.renderer.ts` (:93-266 vertex layout + lambert shader).
- **Done when:** meshes carry normals/uv; scenes show simple shading; snapshots updated intentionally.

### B8 — Trim the sync round-trip
Drop the per-frame `syncPhysicsResults` round-trip for data the renderer now reads straight from WASM.
- **Files:** `src/engine/scene-system.ts`, `src/engine/wasm-physics-bridge.ts`.
- **Done when:** renderer reads transforms directly; no redundant TS-side copy of render data.

---

## Recommended architecture (design reference)

### Per-instance data → storage buffer (not a vertex buffer)
Vertex shaders may read `var<storage, read>` buffers (core WebGPU, no feature flag), and
`@builtin(instance_index)` **includes** `firstInstance`, so `instanceData[instance_index]` indexes a
global array with `firstInstance` as the per-mesh base — no remapping. Drop the instance *vertex* stream.

### Geometry atlas addressed by `baseVertex`/`firstIndex` (bind once)
Bind shared vertex + index buffers **once**, then one `drawIndexed(indexCount, instanceCount, firstIndex,
baseVertex, firstInstance)` per mesh. Keep indices mesh-relative (0-based) so uint16 limits a single mesh,
not the atlas.

### Per-mesh draw table
`{ firstIndex, indexCount, baseVertex, firstInstance, instanceCount, topology }` per mesh from the
contiguous bucket metadata. Drives direct draws now; exactly what `drawIndexedIndirect` consumes later.

### Decouple data layout from draw order (corner-proofing)
Build the seam now even though the redirection buffer is Stage C:
- `instanceData[globalId]` — stable, WASM-owned; mesh-bucket ordering is the no-cull fast path.
- `redirect[]` (later) — per-frame list of visible global ids grouped into contiguous (species,lod)
  slices. Vertex shader does a two-level fetch: `let id = redirect[instance_index]; let inst =
  instanceData[id];`. For now (no culling) `redirect` is identity and skipped.

## WebGPU constraints that shaped these decisions
- Vertex stage can read read-only storage buffers; `instance_index` includes `firstInstance` (direct draws).
- `indirect-first-instance` is **optional** — the future GPU-cull path must NOT rely on a non-zero
  `firstInstance` in `drawIndexedIndirect`; index `redirect[base + instance_index]` via a dynamic-offset
  uniform instead.
- `drawIndexedIndirect` is core; `multiDrawIndirect` is **not** — loop one indirect draw per bucket.
- `textureSample` is illegal in the vertex stage — VAT animation must use `textureSampleLevel`/`textureLoad`.
- Defaults are ample: `maxStorageBuffersPerShaderStage` 8, `maxStorageBufferBindingSize` 128 MiB.

## Corner-avoidance decisions (explicit)
- **Bucket-aware removal** replaces global swap-remove (B2) — the main new data-structure work the naive
  plan glossed over.
- **VAT (baked pose texture), not per-instance skinning**, for the 10k crowd: WASM emits one `anim_time`
  float per soldier; the vertex shader samples a pose texture. Real per-instance bone palettes (~14 MB +
  300k matrix products/frame for 10k unique skeletons) is over-investment — keep `bone_palette_off`
  reserved, don't build it.
- Never build a global index array (keep uint16 mesh-relative + `baseVertex`).

---

## Stage C — Deferred (designed-for, not built now)
- **C1 — vegetation:** more buckets already work; add per-instance tint (have) + in-shader wind (from
  `anim_time` + world pos) + texture-array/alpha-test.
- **C2 — animation:** parametric wobble first (validates `anim_time` plumbing), then VAT via
  `textureSampleLevel`.
- **C3 — CPU redirection buffer** for frustum cull + LOD (two-level fetch; WASM builds per-bucket
  visible-id lists).
- **C4 — compute-shader compaction + `drawIndexedIndirect` per bucket**, with dynamic-offset base
  indexing to avoid `indirect-first-instance`.

## Critical files
- `src/core/game_engine.zig` — `RenderingComponent`/`EntityMetadata` layout (`:78-93`), swap-remove
  (`:1204`, → bucket-aware), offset exports (`:1248`), add draw-table export.
- `src/renderer/webgpu.renderer.ts` — replace hot loop (`:487-524`); atlas bind-once + `baseVertex`
  draws; storage-buffer bind group; widened vertex layout + lambert shader (`:93-266`); topology
  registry (`:441-443`); metadata offset read (`:330-345`).
- `src/renderer/gpu-buffer-manager.ts` — instance upload becomes single storage-buffer write (`:80-117`);
  keep shared atlas (`:29-77`).
- `src/renderer/mesh-registry.ts` — `MeshData` gains normals/uv; store per-mesh `topology`.
- `src/renderer/mesh-utils.ts` — generators emit normals/uv.
- `src/engine/scene-system.ts` — lifecycle fixes (double update `:177-201`, registration `:287-303`,
  init `:138-150`, dead render code `:237/:243+`).
- `src/engine/wasm-physics-bridge.ts` — registration path; bridge TODOs (`:35/:179/:318`); drop per-frame
  round-trip.

## Baseline (fill in before starting)
Capture current state so the refactor can be measured against it:
- `npm run verify` result (typecheck / lint / jest / zig tests) — pass/fail + test count.
- Whether `npm run build` (vite + wasm) succeeds and the WASM size.
- Rough current behavior: does the 1000-instance cap (`webgpu.renderer.ts:393`) hold; do demo scenes
  (basic-shapes, physics, rain) render; do `browser-tests` pass.

## Verification (per increment + at the end)
- Every increment keeps `npm run verify` green (38+ tests); rendering increments add a visual check via
  `npm run dev` (https://localhost:5173) — existing scenes render identically (no ghost triangles,
  correct colors) unless the increment intentionally changes visuals (B7).
- Stage A: tests for single-update (A2) and order-independent registration (A3); browser snapshots green
  (A6).
- Stage B: Zig tests for bucket contiguity after add/remove (B2) and `sizeof(RenderingComponent) == 96`
  with expected field offsets (B4/B6). Instrument a frame to confirm **zero `createBuffer` per frame** and
  one draw call per distinct mesh (B3). Spawn a stress scene (5k+ instances across ≥2 meshes), confirm
  60fps, and confirm lifting the 1000-instance cap no longer regresses.
