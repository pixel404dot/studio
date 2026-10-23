# Studio — Multimodal AI Creative Workspace

A refined, high-density creative workspace for generating images, video, audio, text, and 3D assets across 30+ frontier AI models via **Flora** and **YouMind**.

**Live Demo:** [https://pixel404dot.github.io/studio/](https://pixel404dot.github.io/studio/)

---

## Features

- **Unified Multimodal Composer** — Switch seamlessly between Image, Video, Audio, Text, and 3D generation with model-specific parameter chips (aspect ratio, resolution, duration, batch count, quality, and reference media).
- **Curated Model Picker** — Search and filter models across providers (Google, OpenAI, Black Forest Labs, Kling, Runway, Luma, ElevenLabs, Meshy, and more) with live cost estimates and pinned favorites.
- **Persistent Threads & History** — Every generation run is saved with its exact prompt, model, parameters, seed, and outputs so you can reuse, vary, or inspect any recipe.
- **Workflows Library** — Discover and run multi-step Flora techniques with structured inputs.
- **Direct + Relay Connectivity** — Connects directly to Flora (`https://app.flora.ai/api/v1`) from the browser with automatic workspace relay fallback.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:8080` and connect your Flora or YouMind API key via **Settings**.

## Static Build (GitHub Pages)

```bash
VITE_STATIC_SITE=true BASE_PATH=/studio/ npm run build:static
```
