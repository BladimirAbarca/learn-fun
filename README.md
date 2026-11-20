# Aprende y Juega (Learn&Fun)

Sitio web de aprendizaje para niños, en español. El inicio es un hub de puertas; en la v1 solo **Espacio** está abierto.

Datos del espacio: NASA Planetary Fact Sheet, NASA NeoWs, NASA APOD, NASA Image and Video Library, y catálogo orbital público para objetos cerca de la Tierra.

La clave `NASA_API_KEY` se lee solo en el servidor. Si no la pones, la app usa `DEMO_KEY` de NASA.

## Run on your computer

1. Unzip this folder.
2. Install **Node.js 20 or newer**.
3. In the unzipped folder, run:

```bash
npm install
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) for the hub, then [http://localhost:3000/espacio](http://localhost:3000/espacio) for the night sky.

Optional: set `NASA_API_KEY` in the environment before `npm run dev` for a higher NASA API quota. It is not required.
