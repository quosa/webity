# A3 — Scene-first engine setup API (Proposal B)

Fixes the chicken-and-egg entity registration + mesh-ordering trap by making the `Scene` a
pure declarative tree of GameObjects that reference first-class **asset objects**
(`Mesh`/`Material`), with an `Engine(canvas)` that mounts and runs it. Removes the
"two id-lists to keep in sync" boilerplate. (Alternative Proposal A — string-id + engine
registry — was rejected.)

Branch: `worktree-a3-scene-first-engine-api` (off merged `main` `ef156b9`). Draft PR: **#8**.

---

## ▶ Progress / resume here

**Done (additive object-model foundation — build green each step, all pushed):**
- ✅ **Inc 1** `Mesh` class + `createCube/Sphere/Grid/Pyramid/Triangle` factories — `src/engine/mesh.ts` (commit `2f27f88`)
- ✅ **Inc 2** `Material` + `Material.default` (magenta placeholder) — `src/engine/material.ts` (`b9aea11`)
- ✅ **Inc 3** camera-as-GameObject (unified Transform, 3a) — `CameraComponent` view/projection math from `transform.position`; `PerspectiveCamera`/`OrthographicCamera` GameObject subclasses in `src/engine/camera-object.ts`; equivalence test vs legacy camera (`78b5ae0`)
- ✅ **Inc 4** `MeshRenderer` object mode `(mesh, material?, renderMode?)`, legacy string form kept (`9368c77`, lint fixup `038f60b`)

State: 286 Jest tests + Zig 8/8 + typecheck green. Everything additive — legacy
`scene.init(renderer)` path and all ~14 scenes still work.

**Next (the invasive half):**
- ⏭ **Inc 5** `Engine` facade — new `src/engine/engine.ts`: `init` / `loadScene`(mount) / `start`(loop) / `deinit` + one canonical clamped rAF loop. Still mostly additive.
- ⏭ **Inc 6** `Scene` data-only — `add()` pure insert; move ALL registration into `Engine.loadScene` (single pass, fail-loud, no double-registration, no error-swallow, `awake`/`start` at mount). First breaking change to Scene semantics; keep a temporary compat shim for un-migrated scenes.
- ⏭ **Inc 7** migrate ~14 demo scenes to Engine + object model; add canonical red-ball/blue-pyramid/floor-grid scene + browser test.
- ⏭ **Inc 8** remove legacy (eager registration, `registerEntitiesWithWasm`, string `MeshRenderer` ctor, compat shim, `scene.init(renderer)`); fix stale `src/scenes/CLAUDE.md` + `README.md`.
- ⏭ **Inc 9** ergonomics (optional): `GameObject.cube/sphere/grid`, `RigidBody { kinematic }` opts, `scene.add` primary.

**To resume in a fresh worktree** (a3 worktree is git-only; build artifacts + node_modules are gitignored):
1. `npm install`
2. `npm run build:wasm`  ← required, else WASM-loading tests fail (~27) on a fresh checkout
3. baseline: `npm run typecheck` + `npm test` (expect 286 pass) + `npm run test:wasm` (8/8, needs Zig 0.16)
4. Lint from a `.claude/worktrees` checkout: `node_modules/.bin/eslint --no-ignore <files>` (plain `eslint src` false-fails under a dot-dir).

**Implementation deviations from the original footprint (decided during Inc 1–4):**
- **3a camera**: `lookAt` lives on the camera object/`CameraComponent` (sets target/up), NOT on `Transform` — Transform stays Euler; quaternion-on-Transform + `Transform.lookAt` is a later upgrade. So target `main()` is `cam.transform.setPosition(...)` + `cam.lookAt(...)`.
- **MeshRenderer**: single **union-typed** ctor (no TS overload signatures) — repo's base `no-unused-vars` rejects overload signatures + parameter properties (declare fields explicitly). Object mode maps `Material.color` RGBA → renderer color `{x,y,z,w}`.

**Known footgun — zero-mass colliders are inert (discovered during Inc 7):**
The WASM engine gates simulation/collision on `physics_enabled = mass != 0`
(`game_engine.zig` add_entity), and the collision loop skips `physics_enabled == false`
entities. So a `RigidBody` with `mass = 0` is **silently non-colliding** (the ball fell
through the pyramid). Current mitigation: `Scene.mount()` warns for any mass-0 RigidBody.
Two proper follow-ups (do NOT rely on non-zero mass long-term):
- **Engine fix (Phase-8/WASM, out of A3 scope):** change to
  `physics_enabled = (mass != 0) || isKinematic` (or a real `physics_enabled` flag). Needs
  care — mesh-only static entities currently get `mass=0, isKinematic=true` from the bridge,
  so they'd start entering the collision loop; verify that doesn't regress grid/floor scenes,
  and rebuild the WASM.
- **A3 ergonomics (Inc 9):** a `RigidBody({ kinematic: true })` opt / `StaticBody` helper that
  defaults to a non-zero mass, so authors never have to know about the `mass != 0` gate.

---

## Target `main()` (DX goal)

```ts
async function getScene(): Promise<Scene> {
  const gridMesh    = Mesh.createGrid('grid', 20, 20);
  const pyramidMesh = Mesh.createPyramid('pyramid', 1, 1);
  const sphereMesh  = Mesh.createSphere('sphere', 0.5);
  const gray = new Material('gray', { r:.5, g:.5, b:.5, a:1 });
  const blue = new Material('blue', { r:0, g:0, b:1, a:1 });
  const red  = new Material('red',  { r:1, g:0, b:0, a:1 });

  const scene = new Scene();
  const cam = new PerspectiveCamera('main');   // GameObject subclass (auto-adds CameraComponent)
  cam.transform.setPosition(0,0,-12);
  cam.lookAt(0,-5,0);                           // 3a: lookAt on the camera (not transform)
  scene.setCamera(cam);

  const floor = new GameObject('floor', 'Floor');
  floor.transform.setPosition(0,-8,0);
  floor.addComponent(new MeshRenderer(gridMesh, gray, 'lines'));
  scene.add(floor);

  const pyramid = new GameObject('pyramid', 'Pyramid');
  pyramid.transform.setPosition(0,-7,0);
  pyramid.addComponent(new MeshRenderer(pyramidMesh, blue));
  pyramid.addComponent(new RigidBody(0, false, 'box', { x:.5,y:.5,z:.5 }, { kinematic:true }));
  scene.add(pyramid);

  const ball = new GameObject('ball', 'Ball');
  ball.transform.setPosition(0,2,0);
  ball.addComponent(new MeshRenderer(sphereMesh, red));   // material optional -> Material.default
  ball.addComponent(new RigidBody(1, true, 'sphere', { x:.5,y:.5,z:.5 }));
  scene.add(ball);
  return scene;
}

async function main() {
  const engine = new Engine('webgpu-canvas');
  await engine.init();                 // WebGPU + WASM
  const scene = await getScene();      // pure data
  await engine.loadScene(scene);       // MOUNT: upload assets, register entities (fail-loud)
  engine.start(scene);                 // loop: input > physics > update > render
}
```

## Mount (`Engine.loadScene`) — single deterministic registration point
1. `scene.collectAssets()` → unique meshes + materials.
2. `await` any not-yet-loaded `UrlMesh.load()` (Phase 9); upload each mesh's `data` via
   `renderer.registerMesh(mesh.id, mesh.data)`; register materials. Missing/failed asset → throw here (fail-loud).
3. Register every GameObject with the WASM bridge in one pass; resolve `MeshRenderer.mesh` → mesh index.
4. `scene.awake()` then `scene.start()` over the full tree.

## Public class footprint (target)
- `Mesh` (id + `MeshData`; factories; future `UrlMesh.load()` / `DynamicMesh`).
- `Material` (id + RGBA; `Material.default`; future texture/PBR subclasses).
- `PerspectiveCamera`/`OrthographicCamera` extends `GameObject` (auto-attach `CameraComponent`);
  `CameraComponent.getViewProjectionMatrix(aspect)` = proj × lookAt(transform.position, target, up).
- `MeshRenderer(mesh|id, material?|id, renderMode?, color?)` — holds `mesh`/`material` objects in object mode.
- `Scene` (Inc 6): `add`/`remove`/`getById`/`findByName`/`all`, `setCamera`, `setInputTarget`,
  `collectAssets()`, `awake`/`start`/`update` invoked by Engine; no renderer/WASM held.
- `Engine` (Inc 5): `constructor(canvas)`, `init`, `loadScene`, `start`, `stop`, `deinit`.

## Scope boundary (A3 vs Phase 9/10)
A3 = the object model + mount + scene migration. NOT A3: real file loaders (`UrlMesh.load` body),
`Texture`, textured/PBR materials, water/flag/VAT animation, streaming/ref-counting — Phase 9/10,
hanging off the seams here (`upload`, async `load`, `dynamic` flag, per-instance `anim_time`).

## Delivery
Commit(s) per increment on this branch → single PR **#8** (not a PR per increment). Each
increment keeps `npm run verify` green so history stays bisectable.

## Manual verification results (Inc 7, done with the user)

Scenes rendered correctly: physics, fancy, stack-test, camera-controls, pyramid, triangle,
root static scene (cube-above-grid is **pre-existing** — verified identical on `main`),
input-demo (aside from the control swap below).
Real regressions found + fixed: cube debug button + HMR device-mismatch spam (commit 027c951).

## Backlog — pre-existing issues, NOT A3 regressions (not yet ticketed)

Verified against `main`; the migration did not cause these:
- **input-demo**: forward/back movement controls are swapped.
- **box-sphere** scene (stack-test/box-sphere-scene.ts, still on legacy): ball sinks slightly
  into the box; "drop sphere" button and sphere-position buttons do nothing. (User: leave for last.)
- **physics scene**: up/down/left/right force controls log but have no visible effect
  (applyForce → wasm.apply_force path / force magnitude).
- **pyramid** scene: split into a simple scene + a separate all-mesh-types validation scene.
- **Decorative floors** (rain, physics-system, canonical basic-physics): grids have no collider,
  so objects fall to the WASM world-bounds floor at y=-8. User chose to LEAVE them decorative
  (declined adding `RigidBody.staticBody` floors).

## Tracked follow-up tasks (engine/cleanup)
1. Engine `physics_enabled = mass != 0` gate fix (Phase 8).
2. ✅ Engine restart safety (idempotent `start()`/`stop()`) — done on branch `engine-lifecycle`
   (PR #11). `start()`/`stop()` are arg-less + idempotent (warn + no-op), `start()` runs the
   component lifecycle once per mount (`hasStarted` latch) so resume ≠ re-start, and `loadScene`
   now *replaces* the current scene (reusing the device) so reset/level-switch are one caller-side
   `loadScene(build()) + start()`. NOTE: this did not remove a per-scene HMR stopgap because no
   scene actually wires `import.meta.hot.dispose` today — it removes the *need* for one.
3. ✅ Inc 8: full legacy removal (string MeshRenderer ctor + scene.init + docs + factories + box-sphere) — done on branch `a3-cleanups`.
4. Shared `runScene()` bootstrap helper + adopt across ~15 scenes (/simplify #1).
5. ✅ Engine owns runtime mesh registration (drop `getRenderer()` leak; added `Engine.registerMesh`) — done on branch `a3-cleanups`.
6. ✅ Camera unification (retired legacy `camera.ts`/viewProvider/scene.camera split; `CameraComponent` is the single source, `Scene.camera` is a getter) — done on branch `a3-cleanups`. Also fixed the `renderer/scene.ts` "perspective off" TODO.
7. **Coverage refinement (TS + Zig):** the cleanup net-removed ~9 tests and left new code under-covered. From `npm run test:coverage`: `engine.ts` ~24% (unit-test `init`/`loadScene`/`registerMesh`/`start`/`stop`/`deinit` with a mock renderer, cf. the `MockRenderer` in `scene-input-integration.test.ts`); `scene-system.ts` `setCamera` rebind + the `camera` getter (~L302-304); `camera-object.ts` `OrthographicCamera` ctor branch (L41-43); `components.ts` RigidBody lifecycle branches (L246-252, L334-361). Zig: run `npm run test:wasm:coverage` and top up any core physics/collision paths that regressed.
8. **`RigidBody` flags — `useGravity` is a dead no-op; the flag model is too coarse (needs more research):**
   - **Data-flow finding (traced 2026-07-10):** `RigidBody.useGravity` (`components.ts:221`) is **write-only** — nothing reads it at runtime, and the WASM ABI `add_entity(…, mass, radius, isKinematic)` (`wasm-physics-bridge.ts:166`) **has no `useGravity` parameter**. Zig `add_entity` derives only `physics_enabled = mass != 0` (`game_engine.zig:1194`) and `is_kinematic = isKinematic` (`:1170`); gravity is a single global `physics_gravity = -9.8` (`:42`) applied to every non-kinematic, physics-enabled body in `updateECSPhysics` (`:293-335`). So `useGravity` currently affects nothing.
   - **Actual behavior of the 4 combos (mass ≠ 0):** `!kinematic` → falls & collides regardless of `useGravity` (this is why `new RigidBody(10000, false, …)` still fell); `kinematic` → integration skipped, stays put, still a collider (= `staticBody`), `useGravity` moot. `mass == 0` → `physics_enabled=false` → fully inert incl. skipped by the collision loop (see the zero-mass footgun above, item #1).
   - **Key insight — there IS a legitimate use case for "no gravity but NOT kinematic":** a *dynamic* body that floats in place yet still collides and responds to forces/impacts (floating platform, balloon, space debris). `kinematic` is **not** a substitute — a kinematic body ignores forces/collisions entirely. This "dynamic + no-gravity" state is genuinely unsupported today.
   - **Decision to research, not yet made:**
     - *Option A — make `useGravity` real:* add a per-entity `use_gravity` bit to `PhysicsComponent` + an `add_entity` param, plumb via the bridge, and gate the gravity line (`game_engine.zig:301`) on it. Unlocks the floating-dynamic state; pairs naturally with the item #1 `physics_enabled` gate fix (both are "the WASM entity-flags ABI is too coarse"). Needs `build:wasm` + regression check on grid/floor scenes.
     - *Option B — drop `useGravity` (YAGNI):* removes no working behavior today, but gives up the API slot for floating-dynamic bodies (re-add later if wanted). Breaking change across **62 `new RigidBody(` call sites**; must *remove* the positional arg (never same-position-swap to `kinematic` — that would silently flip every dynamic body to immovable). The existing `useGravity=false` sites (e.g. `input-demo/scene.ts:44,58`, `jku-scene.ts` staticCube) are **latent-intent bugs** — authors expected "no fall" and never got it; each needs a per-site dynamic-vs-kinematic decision.
   - Best done as its own PR, not folded into the A3 cleanup.
9. **Static (mesh-only) entities silently drop their initial rotation (found 2026-07-10):**
   `add_entity` bakes **position + scale** into the render matrix but has **no rotation param**
   (`game_engine.zig:1176-1188` — always identity rotation). Rotation only reaches WASM later via
   `set_entity_rotation`, which is called from `RigidBody.syncToWasm()` (`components.ts:271-273`),
   and that runs only for a **kinematic RigidBody** (or a `RotatorComponent` animates `phys.rotation`
   directly). So a GameObject with a MeshRenderer but **no RigidBody** never has its
   `transform.setRotation()` applied — it renders unrotated (position/scale still work).
   - **Repro:** a `createGrid` wall with `setRotation(0,0,90)` and no RigidBody stays flat.
   - **Workaround today:** attach a kinematic body (`RigidBody.staticBody(...)`); its per-frame
     `syncToWasm()` pushes the rotation (also makes it a collider).
   - **Fix:** add rotation params to the `add_entity` ABI and build the matrix via
     `updateECSTransformMatrix` at add time, so position/scale/rotation all apply for static
     entities without needing a RigidBody. WASM ABI change + `build:wasm`; same "entity/transform
     ABI is too coarse" family as items #1 and #8.
10. **Renderer picks the draw pass from a hard-coded mesh-id allowlist, not the mesh's render mode (found 2026-07-10):**
    `renderWasmInstancesByMode` filters entities against literal id lists
    (`webgpu.renderer.ts:441-442`: `triangleMeshes = ['triangle','cube','sphere','pyramid']`,
    `lineMeshes = ['grid']`). Any mesh id **not** in the matching list is silently skipped in
    **both** passes, so a custom-id mesh (e.g. `Mesh.createGrid('floorGrid', …)` /
    `'wallGrid'`) renders nothing. The `renderMode` on `MeshRenderer` is not consulted. This is
    the standing `:440`/`:453` TODOs.
    - **Workaround today:** reuse the blessed ids (`'grid'` for lines, `'cube'`/`'sphere'`/etc.
      for triangles). Note `loadScene` dedups meshes by id, so one id == one geometry — you can't
      have two differently-sized `'grid'` meshes.
    - **✅ Done (branch `renderer-render-mode`):** threaded the real render mode through
      registration — `registerMesh(id, data, renderMode = 'triangles')` stores it on the
      `MeshRegistry` allocation entry; `Engine.loadScene` passes `meshRenderer.renderMode` (and
      `Engine.registerMesh(mesh, mode?)` for runtime spawns); the render loop filters by the
      mesh's registered mode. Extracted a shared `RenderMode` type in `mesh-registry.ts`. No
      WASM/ABI change — TS renderer + engine only. Per-mesh-id keying (one mode per id).
    - **Deeper form (deferred, belongs with the ABI cluster #8/#9):** render mode is modeled
      per-*entity* everywhere else (`MeshRenderer.renderMode`, `EntityData`), so the truly
      correct seam is a `render_mode` field in the WASM `EntityMetadata` (mirroring `mesh_id`),
      read per-entity in the render loop. That removes the per-mesh-id "one mode per id"
      limitation (same mesh drawn both ways) and the registration threading — but it's a WASM
      ABI change, so it rides with #8/#9 rather than the TS-only pass above.
11. **Scene is still the runtime coordinator, not pure data — the core A3 goal is unfinished
    (found reviewing PR #11, 2026-07-11):** the target footprint says *"Scene … no renderer/WASM
    held,"* but today the `Scene` **owns** the `WasmPhysicsBridge` (`scene-system.ts:46`, public)
    and runs the whole runtime: `mount()` registers entities (`:191`), `update()` drives
    `physicsBridge.update()` then `render()` (`:238`), and `render()` reads WASM memory + calls the
    renderer (`:262`). The Engine is just device + loop scheduling delegating to the Scene.
    - **Why it matters:** "Scene = pure data" is the whole point of A3; until the runtime moves to
      the Engine, `mount()`/`update()`/`render()` living on the Scene is the wrong side.
    - **Target:** the Engine owns `renderer` **and** `physicsBridge`; the Scene holds only
      GameObjects + camera + input config + `awake/start/update`(components) hooks. `Engine.loadScene`
      does registration; the Engine frame loop runs input → components → `bridge.update` → render.
    - **The real cost — ~60 `scene.physicsBridge.*` call sites** must re-route: scene debug/console
      hooks (stats, collision counters, wasm memory), `input-controller.ts:129` (`applyForce`), and
      ~a dozen tests. Expose a read-only `engine.physics`/stats accessor for the debug hooks and give
      the input controller a bridge handle. Own PR — bigger than #11, touches every scene + tests.
      PR #11's `mount(renderer, wasm)` (Engine supplies the module) is a first nudge in this direction.

## Resume pointer
Branch `worktree-a3-scene-first-engine-api` → **PR #8** (draft). Core A3 done + green
(typecheck / 296 Jest / Zig 8/8 / lint / builds). To resume in a fresh worktree: `npm install`
→ `npm run build:wasm` → baseline. Next actionable: address PR review, then tasks above.
