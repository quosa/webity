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
