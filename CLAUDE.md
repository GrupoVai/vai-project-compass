# VAI Projetos 2.0

- Este repositório é só do **VAI Projetos 2.0** (Pedro). Nunca alterar o VAI Projetos 1.0 (Renan).
- Backend do 2.0: `qsvffwsdifsfpzgbmpdt`. Nunca apontar para o banco do 1.0 (`mqcpwefunymjcakdifxc`).
- O sistema fica em `src/paginas/sistema.ts` (página HTML única servida em `/`); a demo em `src/paginas/demo.ts` (`/demo`).
- Banco: tabelas `v2_*` + `perfis`, criadas pela migração `drizzle/migrations/0000_vai_projetos_2_0.sql`.
  As alçadas valem no banco (regras de acesso), não só na tela.
- Novos cadastros nascem pendentes; administradores fixos ficam em `admins_fixos`.
