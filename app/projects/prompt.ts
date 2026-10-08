import type { Project } from "./projects";

// Where the agent downloads everything from. Temporary: straight from the public repo.
// Moving to a CDN or another branch means changing only this line.
export const SOURCE_BASE = "https://raw.githubusercontent.com/hasot/3-labs/main";
// The deployed lab, to compare the result against
export const LIVE_BASE = "https://hasot.github.io/3-labs";

// Every page sits inside the lab's root layout: fonts (incl. the local Williwaw)
// and the keyframes in globals.css
const SHARED_FILES = ["app/layout.tsx", "app/globals.css", "app/fonts/Williwaw-Book.woff2", "app/fonts/Williwaw-OFL.txt"];

export const liveUrl = (slug: string) => `${LIVE_BASE}/examples/${slug}/`;

export function downloadList(project: Project) {
  return [...SHARED_FILES, ...project.files];
}

function curlLines(paths: string[]) {
  return paths.map((path) => `curl -fL --create-dirs "$SOURCE_BASE/${path}" -o "${path}"`).join("\n");
}

export function buildPrompt(project: Project) {
  const dir = project.slug;
  const spec = project.prompt.map((s, i) => `${i + 1}. **${s.title}.** ${s.body}`).join("\n");
  const frames = project.frames
    ? `

# Frame sequence: ${project.frames.count} numbered frames
for i in $(seq -f "%03g" 1 ${project.frames.count}); do
  curl -fsL --create-dirs "$SOURCE_BASE/${project.frames.dir}/$i.webp" -o "${project.frames.dir}/$i.webp"
done`
    : "";
  const install = project.packages?.length
    ? `## Step 2. Install packages

\`\`\`bash
npm install ${project.packages.join(" ")}
\`\`\`
`
    : `## Step 2. Packages

Nothing extra to install: the page only needs what create-next-app already set up.
`;

  return `# Prompt: ${project.title}

> **How to use.** Create an empty folder, open it in Claude Code (or Cursor, Codex — any agent that can run terminal commands), paste everything below the line as one message and send it. The agent creates the project, downloads the sources and assets, and starts the site.
>
> Everything is downloaded from \`SOURCE_BASE\` in step 3. If the files move, change only that line.

---

You are a senior frontend developer. Build and run locally the interactive page "${project.title}". The reference implementation is public: you download its exact source files and assets, put them in place and start the site. Do not rewrite or "improve" the downloaded code — it builds and works as is.

Live reference to compare against: ${liveUrl(project.slug)}

## What it should look like

${project.summary}

How it works:

${spec}

## Stack (versions matter)

- **Next.js 16.3.8** (App Router, Turbopack), **React 19.2.8**, **TypeScript**, **Tailwind CSS v4**.
- Node.js **20.9 or newer** (check \`node -v\`).

> ⚠️ Next.js 16 differs from what you remember from training. If you need to touch a Next.js API, read the docs in \`node_modules/next/dist/docs/\` first.

## Step 1. Create the project

\`\`\`bash
npx --yes create-next-app@16.3.8 ${dir} --yes
cd ${dir}
\`\`\`

All further commands and paths are relative to the \`${dir}\` folder.

${install}
## Step 3. Download the sources and assets

Every file goes to the same path as in the reference repo; existing \`app/layout.tsx\` and \`app/globals.css\` are replaced on purpose.

\`\`\`bash
SOURCE_BASE="${SOURCE_BASE}"

${curlLines(downloadList(project))}${frames}
\`\`\`

\`curl -f\` stops on a missing file. If one fails with 404, stop and tell the user which path is missing — do not invent a replacement.

## Step 4. Show the page at the root

Make the home page render this one:

\`\`\`bash
cat > app/page.tsx <<'EOF'
export { default } from "./examples/${project.slug}/page";
EOF
\`\`\`

The page also stays reachable at \`/examples/${project.slug}\`.

## Step 5. Run and check

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:3000 and compare with ${liveUrl(project.slug)}. Check that:

- Every point of "How it works" above behaves the same as on the live reference.
- All assets load: no 404s in the browser's Network tab.
- There are no errors in the terminal or the browser console, and \`npx tsc --noEmit\` passes.

Finish by telling the user the local URL and anything that did not match the reference.
`;
}
