import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VAI Projetos" },
      { name: "description", content: "VAI Projetos" },
      { property: "og:title", content: "VAI Projetos" },
      { property: "og:description", content: "VAI Projetos" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      VAI Projetos
    </div>
  );
}
