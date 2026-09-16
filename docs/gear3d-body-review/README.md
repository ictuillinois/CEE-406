# Gear3D vehicle bodies: feasibility, implementation and visual review

## Result

The overlay is feasible and implemented as **Show vehicle body** under Isolation.
It starts enabled in Quad view with the grid off, works with the existing view and isolation controls, follows
geometry edits, and is saved in project files. Bare FAA schematic configurations
have no invented airframe. Engineering geometry and footprint exports exclude the
body; rendered figures include it when enabled.

The first procedural prototype was replaced after the request for stronger
fidelity. The shipped bodies use the actual licensed source mesh triangles,
prepared locally into small GLB assets. This preserves recognizable fuselages,
wings, engines, tails, cabs, pickup beds and motorcycle bodywork.

[Full 737 overlay](app-b737-800.png) · [A380 overlay](app-a380-800.png) ·
[747 overlay](app-b747-400.png) · [tractor/semitrailer overlay](app-fhwa-c09-3S2.png)

## Assessment and source selection

| Approach | Assessment |
| --- | --- |
| Primitive procedural bodies | Light and flexible, but insufficient visual fidelity to the source vehicles. Replaced. |
| Kenney Car Kit | CC0; separated wheel nodes make removal reliable. Supplies sedan, pickup and truck/cab bodies. |
| AMV Lab aircraft models | CC BY 4.0; compact, logo-free GLBs with recognizable aircraft geometry. Supplies 737, A380 and 787 airframes. |
| Prepared 747 from God's Eye View | CC BY 4.0, original author zairiq-123; the distinctive upper deck and four-engine layout suit the 747 gear entries. |
| Quaternius Public Transport | CC0; original OBJ has separate front and rear wheel objects. Supplies the bus. |
| AliceCassie motorcycle | CC0; combined meshes require removing triangles around wheel regions. Supplies motorcycle bodywork. |

[Full credits, source links, licenses and modifications](../../public/gear3d/bodies/CREDITS.md).
The asset source URLs and SHA-256 hashes are recorded in
[the provenance manifest](../../scripts/gear3d-body-assets/sources.json).

### Coverage and accuracy

* All shipped road classes receive a body. Heavy combinations use cargo shells
  cropped from the source delivery truck; doubles receive two bodies, with the
  dolly in the second trailer group. Cargo proportions remain illustrative.
* The 737, 747 and A380 use their corresponding airframe families. The 757 uses
  the 737 reference shape; the 767 and 777 use the 787 reference shape. The
  interface names the actual reference airframe. These are representative
  substitutes, not variant-specific aircraft models.
* Road wheelbase alignment uses source wheel centers, with overhangs scaled
  separately so a longer axle span does not lengthen the nose excessively.
  Width and height are adjusted to the selected vehicle layout.
* Aircraft bodies use **assumed** nose/main stations at 13% and 54% of body
  length. Uniform scaling aligns those stations to the selected gear layout.
  Body height follows the existing main-gear struts, with clearance above the
  pavement. Manufacturer CAD gear attachment points were not available in these
  meshes. Relative body/gear placement is therefore approximate.
* The source assets are stylized low-poly geometry. Fidelity to those meshes is
  established below; photorealism and aircraft certification dimensions are not.

## Pixel-by-pixel comparison

Thirty-three comparisons cover eleven assets in **isometric, side and overhead** views.
Each uses the same 480 × 360 WebGL render size, camera, framing, white background,
lighting and opaque neutral material. The left image comes directly from the
source body after wheel removal and coordinate normalization. The middle image
loads the prepared local GLB. The right image shows every RGB channel's absolute
difference, amplified twelve times.

All 33 comparisons yielded **0 changed pixels, mean absolute RGB error 0/255,
and silhouette intersection-over-union 1.0** in the tested Chrome renderer.
[Machine-readable measurements](pixel-comparison.json).

This establishes that local preparation preserves the retained source geometry.
It does **not** compare against a photograph, include deliberately removed wheels
or source textures, or claim pixel identity after the runtime body is stretched,
positioned, dimmed and combined with the tool's gear. The trailer comparison uses the source cargo crop (above the wheel wells and
behind the cab), before its runtime stretch. These distinctions prevent the
comparison from implying an accuracy the data does not support.

| Source body | Isometric comparison | Side | Overhead |
| --- | --- | --- | --- |
| 737 | [View](B737-iso.png) | [View](B737-side.png) | [View](B737-top.png) |
| A380 | [View](A380-iso.png) | [View](A380-side.png) | [View](A380-top.png) |
| 787 reference | [View](B787-iso.png) | [View](B787-side.png) | [View](B787-top.png) |
| 747 | [View](B747-iso.png) | [View](B747-side.png) | [View](B747-top.png) |
| Sedan | [View](sedan-iso.png) | [View](sedan-side.png) | [View](sedan-top.png) |
| Pickup | [View](truck-iso.png) | [View](truck-side.png) | [View](truck-top.png) |
| Rigid truck | [View](delivery-iso.png) | [View](delivery-side.png) | [View](delivery-top.png) |
| Cab/deck | [View](delivery-flat-iso.png) | [View](delivery-flat-side.png) | [View](delivery-flat-top.png) |
| Trailer cargo | [View](trailer-iso.png) | [View](trailer-side.png) | [View](trailer-top.png) |
| Bus | [View](bus-iso.png) | [View](bus-side.png) | [View](bus-top.png) |
| Motorcycle | [View](motorcycle-iso.png) | [View](motorcycle-side.png) | [View](motorcycle-top.png) |

## Cost and behavior

The eleven GLBs total approximately **649 KB**. Individual assets are 17–97 KB,
with 212–3,378 triangles. Only the selected asset downloads after opt-in; shared
requests and a cache avoid repeated downloads. There are no texture requests or
external-host dependencies at runtime. Body geometry and owned materials are
disposed with the assembly; cached templates are disposed when the tool unmounts.
The base surface has 28% opacity, with stronger bus glazing and trim, does not cast shadows, and is excluded from picking,
measurement snaps and engineering exports. Camera fitting includes visible body
vertices so wings and tails remain in frame.

## Reproducing the asset review

1. Download the source files listed in the provenance manifest into a local
   directory; extract `car-kit.zip` into its `kenney` subdirectory. Keep the
   archive's original `Models/GLB format` paths. Validate the SHA-256 hashes.
2. Install Playwright for development and have Chrome installed. The application
   itself does not depend on Playwright. `PLAYWRIGHT_MODULE` can point to an
   existing Playwright ESM installation using a `file:` URL.
3. Run `node scripts/build-gear3d-bodies.mjs <source-directory>` from the repo root.
   The script serves a temporary localhost harness, rebuilds the GLBs, renders
   all comparisons, records the metrics and fails on a fidelity regression.
4. Run `node --test src/components/react/gear3d/*.test.mjs` for the gear and body
   geometry checks. Body tests load the shipped GLBs without a server and check
   every library layout, finite coordinates, ground clearance, actual vertex
   containment in camera bounds, lazy body creation and export exclusion.

Browser smoke checks additionally exercise Quad/body-on/grid-off defaults, enabling,
changing between truck and aircraft models, full-aircraft framing and disabling.
The save/reopen round trip and disabled-by-default network behavior are also
checked by `node scripts/check-gear3d-bodies.mjs <running-tool-URL>`.
The included application screenshots come from the actual React Gear3D island,
bundled in a local browser harness.


## Final validation

* 36 Gear3D geometry, unit and token checks passed.
* 33 matched-camera source-body comparisons: zero changed pixels.
* Browser checks passed for saved and legacy projects, failed body requests,
  default body loading, isolation, model changes, quad view and disabling.
* The production Astro build and Pagefind indexing passed in a clean temporary
  copy with the same lockfile. The Box workspace intermittently locked native
  esbuild/Rollup dependencies; no application dependency changes were needed.

## Refinement iteration

The viewport offers Copy PNG and Download PNG, with solid-background and transparent options. Both capture the current view and dimension overlay. Bus orientation follows named source front/rear wheels; authored glazing and trim are retained separately, with added doors, mirrors, lights and roof ventilation. Tractor cab fitting spans the steering and first drive group independently of trailer axles. Road bodies gain bumper, lamp and mirror details; dump trucks gain open beds and reinforcing ribs. Aircraft retain their shape with subtle intake shading. These runtime additions and fitting changes are illustrative; source pixel comparisons validate the prepared source surfaces, not these additions or calibrated vehicle dimensions.

[Refined bus](app-bus-refined.png) · [Open dump bed](app-dump-refined.png) · [Enlarged tractor](app-tractor-refined.png)

Validation: 37 geometry/unit/style checks pass, Chrome smoke checks pass, opaque and transparent PNG downloads and clipboard copies pass, and the production build generates all 33 pages. Transparent pixels were verified from decoded PNG data; the figure annotations and Quad pane borders remain visible.
