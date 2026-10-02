# 🎨 3D Labs

Three.js learning laboratory with React Three Fiber + Next.js 15.

**Status:** Ready for development  
**Examples:** 3 (Floating Box, Rotating Cube, Particle System)  
**Skills installed:** 43 (Three.js Skills, Game Skills, Awesome Graphics)

## Quick Start

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
3-labs/
├── app/
│   ├── page.tsx                 # Home (examples list)
│   ├── examples/[slug]/page.tsx # Dynamic example page
│   └── globals.css
├── components/
│   └── examples/                # Example components
│       ├── FloatingBox.tsx
│       ├── RotatingCube.tsx
│       └── ParticleSystem.tsx
├── .claude/
│   └── skills/                  # 43 Three.js skills
└── package.json
```

## Examples

- **Floating Box** - Basic geometry + physics (Rapier)
- **Rotating Cube** - Animation with useFrame
- **Particle System** - Instanced particles (1000 particles)

## Stack

- **Next.js 15** (App Router)
- **React 19**
- **Three.js** (latest)
- **React Three Fiber** - Declarative 3D with React
- **Drei** - Useful R3F components
- **@react-three/rapier** - Physics simulation
- **Tailwind CSS** - Styling

## Skills (43 installed)

### Three.js Skills (10)
threejs-fundamentals, threejs-geometry, threejs-materials, threejs-lighting, threejs-textures, threejs-animation, threejs-loaders, threejs-shaders, threejs-postprocessing, threejs-interaction

### Game Skills (9)
threejs-game-director, threejs-aaa-graphics-builder, threejs-gameplay-systems, etc.

### Awesome Graphics (24)
threejs-procedural-geometry, threejs-volumetric-clouds, threejs-raymarched-space-effects, threejs-shader-systems, etc.

## Development

### Add a new example
1. Create component in `components/examples/YourExample.tsx`
2. Add to imports in `app/examples/[slug]/page.tsx`
3. Add to EXAMPLES object with slug

### Use Claude Code with skills
Claude automatically loads relevant skills when you ask about Three.js, lighting, shaders, etc.

## Performance

- Use `InstancedMesh` for 1000+ identical geometries
- Lazy load examples with `next/dynamic`
- Use `OrbitControls` for camera interaction

## Resources

- [Three.js Journey](https://threejs-journey.com/)
- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber/)
- [Drei Components](https://github.com/pmndrs/drei)
- [Awesome React Three Fiber](https://github.com/gsimone/awesome-react-three-fiber)
