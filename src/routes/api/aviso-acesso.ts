import { createFileRoute } from "@tanstack/react-router";

/* E-mails de aviso do acesso (pedido recebido, aviso aos admins, aprovado, recusado).
   Os textos já estão definidos aqui; o envio só passa a acontecer quando o domínio de e-mail
   estiver configurado. Até lá a rota responde ok e não envia nada (o cadastro nunca quebra). */
type Perfil = { id: string; nome: string; email: string; papel: string; status: string };
type Aviso = { para: string; assunto: string; texto: string; link?: string };

async function enviarAviso(_a: Aviso): Promise<boolean> {
  return false; // domínio de e-mail ainda não configurado
}

export const Route = createFileRoute("/api/aviso-acesso")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (b: unknown, status = 200) =>
          new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
        const base = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!base || !key) return json({ ok: false }, 500);
        const svc: Record<string, string> = { apikey: key };
        if (!key.startsWith("sb_")) svc["Authorization"] = `Bearer ${key}`;
        const jwt = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const ur = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${jwt}` } });
        if (!jwt || !ur.ok) return json({ ok: false }, 401);
        const quem = (await ur.json()) as { id?: string };
        const perfil = async (filtro: string) => {
          const r = await fetch(`${base}/rest/v1/perfis?${filtro}&select=id,nome,email,papel,status`, { headers: svc });
          return r.ok ? ((await r.json()) as Perfil[]) : [];
        };
        const eu = (await perfil(`id=eq.${quem.id}`))[0];
        if (!eu) return json({ ok: false }, 403);
        const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const tipo = String(corpo["tipo"] ?? "");
        const origem = new URL(request.url).origin;
        const avisos: Aviso[] = [];

        if (tipo === "pedido" && eu.status === "pendente") {
          avisos.push({
            para: eu.email,
            assunto: "Recebemos seu pedido de acesso",
            texto: "Recebemos seu pedido de acesso à VAI Projetos. Você será avisado por e-mail quando for liberado.",
          });
          const ar = await fetch(`${base}/rest/v1/admins_fixos?select=email`, { headers: svc });
          const admins = ar.ok ? ((await ar.json()) as { email: string }[]) : [];
          for (const a of admins)
            avisos.push({
              para: a.email,
              assunto: `Nova solicitação de acesso: ${eu.nome}`,
              texto: `${eu.nome} (${eu.email}) pediu acesso à VAI Projetos.`,
              link: `${origem}/#solicitacoes`,
            });
        } else if ((tipo === "aprovado" || tipo === "recusado") && eu.papel === "admin" && eu.status === "ativo") {
          const id = String(corpo["id"] ?? "");
          if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false }, 400);
          const p = (await perfil(`id=eq.${id}`))[0];
          if (p && tipo === "aprovado" && p.status === "ativo")
            avisos.push({ para: p.email, assunto: "Seu acesso foi liberado", texto: "Seu acesso à VAI Projetos foi liberado.", link: `${origem}/` });
          if (p && tipo === "recusado" && p.status === "recusado")
            avisos.push({ para: p.email, assunto: "Pedido de acesso não aprovado", texto: "Seu pedido de acesso à VAI Projetos não foi aprovado." });
        } else return json({ ok: false }, 400);

        let enviados = 0;
        for (const a of avisos) {
          try {
            if (await enviarAviso(a)) enviados++;
          } catch (e) {
            console.error("aviso-acesso", e);
          }
        }
        return json({ ok: true, enviados });
      },
    },
  },
});
