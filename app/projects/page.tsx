import type { Metadata } from "next";
import { ProjectsGallery } from "./ProjectsGallery";
import "./projects.css";

export const metadata: Metadata = {
  title: "Projects — 3D Labs",
  description: "Interactive landing pages in progress, with step-by-step prompts to rebuild them.",
};

export default function ProjectsPage() {
  return <ProjectsGallery />;
}
