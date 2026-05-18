# Disturbance images for Vector Forest

Add PNG files here for the scenario carousel. Expected filenames:

- `baseline.png` – no disturbance
- `tornado.png` – wind damage
- `flood.png` – flooding
- `fire.png` – fire

Paths in the app use `/disturbances/<filename>.png`. If you use different names, update `web/src/lib/vectorForest/scenarioCatalog.ts` (imageSrc for each scenario).
