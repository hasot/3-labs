import { ExampleView } from "./ExampleView";

const SLUGS = ["floating-box", "rotating-cube", "particle-system"];

export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export default async function ExamplePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ExampleView slug={slug} />;
}
