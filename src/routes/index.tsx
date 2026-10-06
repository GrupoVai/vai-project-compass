import { createFileRoute } from "@tanstack/react-router";

// A página inicial ("/") é servida diretamente por src/server.ts com o código
// do demo aprovado do VAI Projetos. Esta rota fica apenas como reserva.
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return null;
}
