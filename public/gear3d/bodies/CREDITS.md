# Gear3D vehicle body assets

These are illustrative visual models, not measured manufacturer CAD. They are
separate from the cited axle/gear data. Assets are served locally and loaded only
when Show vehicle body is enabled. No original textures or liveries are shipped.

## Aircraft

* **B737.glb, A380.glb, B787.glb**: AMV Lab, [aircraft-models](https://github.com/amvlab/aircraft-models), plain/logo-free variants. [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
* **B747.glb**: [“boeing 747” by zairiq-123](https://sketchfab.com/3d-models/boeing-747-9b16672038ba48f98e6d80a159044ed9), [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Downloaded from [God's Eye View's prepared asset](https://github.com/bilawalsidhu/gods-eye-view/blob/main/public/models/README.md), which already simplified geometry/materials and baked orientation and scale.

CEE-406 changes: textures/materials removed; node transforms baked; nose oriented
toward render -Z; longitudinal origin moved to the nose; position/normal buffers
re-exported as GLB. Triangles retained. Runtime adds a dimmed material and scales
and places the body using representative gear stations (13% and 54% of body
length). These stations are assumptions, not manufacturer measurements.

The 737 gear uses the 737 body, the 747 variants use the 747 body, and the A380
uses the A380 body. The 757 uses a representative 737 silhouette; the 767 and 777
use a representative 787 silhouette. These substitutions are named in the UI;
they do not claim variant-specific wing, fuselage or engine dimensions.

## Road vehicles

* **sedan.glb, truck.glb, delivery.glb, delivery-flat.glb, trailer.glb**: [Kenney Car Kit 3.1](https://kenney.nl/assets/car-kit), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). `truck` is the pickup body. `delivery` supplies a rigid truck; `delivery-flat` supplies the tractor/cab reference.
* **bus.glb**: Quaternius, [Public Transport Pack](https://quaternius.com/packs/publictransport.html), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Converted from the author's original Bus.obj.
* **motorcycle.glb**: AliceCassie, [Cartoony Purple Motorcycle](https://poly.pizza/m/j20srJUjpB), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

CEE-406 changes: separate wheel meshes removed from Kenney and Quaternius models;
wheel-region triangles removed from the motorcycle's combined meshes; textures
and materials replaced (bus surface names retained); transforms and orientation baked; GLB re-exported. Road
body wheel stations come from source wheel centers (motorcycle centers were
identified from the mesh). Runtime stretches the wheelbase to the selected axles,
preserves overhang proportions relative to width, and adapts height and width.
The trailer asset crops the original delivery-truck cargo shell above its wheel
wells and behind the cab, preserving the retained source surfaces. Runtime
stretches that cargo shell around the selected trailer axle groups. Body
placement and trailer proportions remain illustrative.

## Reuse and figures

Retain the aircraft credits, license links, and modification statement when
redistributing these models or figures made with them. The credits do not imply
endorsement by any original creator.

See `docs/gear3d-body-review/README.md` for the render comparisons and limitations.

Runtime refinements include bus glazing/trim, doors, mirrors, lamps, roof equipment, enlarged tractor cabs, chassis details, open dump beds and subtle aircraft intake shading. These additions are illustrative and do not alter engineering exports.
