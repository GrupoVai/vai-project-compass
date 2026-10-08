import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { PAGINA_DEMO } from "./paginas/demo";
import { PAGINA_SISTEMA } from "./paginas/sistema";
import { EXEMPLOS_1 } from "./paginas/exemplos1";
import { EXEMPLOS_2 } from "./paginas/exemplos2";
import { EXEMPLOS_3 } from "./paginas/exemplos3";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry);
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const caminho = new URL(request.url).pathname;
      if (caminho === "/api/admin-usuarios") return await adminUsuarios(request);
      if (caminho === "/") return paginaHTML(PAGINA_SISTEMA);
      if (caminho === "/demo" || caminho === "/demo/") return paginaHTML(PAGINA_DEMO);
      if (caminho === "/vai-exemplos.js") {
        return new Response(EXEMPLOS_1 + EXEMPLOS_2 + EXEMPLOS_3, {
          headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

/* ===================== VAI Projetos =====================
   "/"      → sistema (login real, dados no Lovable Cloud)
   "/demo"  → demonstração (dados fictícios no navegador)
   "/api/admin-usuarios" → ações do administrador na equipe */
function paginaHTML(html: string): Response {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

async function adminUsuarios(request: Request): Promise<Response> {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  if (request.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  const base = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!base || !key) return json({ erro: "Servidor sem configuração do banco." }, 500);
  const svc: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (!key.startsWith("sb_")) svc["Authorization"] = `Bearer ${key}`;

  const jwt = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ erro: "Faça login de novo." }, 401);
  const ur = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${jwt}` } });
  if (!ur.ok) return json({ erro: "Faça login de novo." }, 401);
  const quem = (await ur.json()) as { id?: string };
  if (!quem.id) return json({ erro: "Faça login de novo." }, 401);
  const pr = await fetch(`${base}/rest/v1/perfis?id=eq.${encodeURIComponent(quem.id)}&select=papel,status`, {
    headers: svc,
  });
  const eu = pr.ok ? ((await pr.json()) as { papel: string; status: string }[])[0] : undefined;
  if (!eu || eu.papel !== "admin" || eu.status !== "ativo")
    return json({ erro: "Só o administrador pode fazer isso." }, 403);

  let corpo: Record<string, unknown> = {};
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ erro: "Pedido inválido." }, 400);
  }
  const acao = String(corpo["acao"] ?? "");

  if (acao === "criar") {
    const nome = String(corpo["nome"] ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const email = String(corpo["email"] ?? "")
      .trim()
      .toLowerCase();
    const senha = String(corpo["senha"] ?? "");
    const papel = corpo["papel"] === "admin" ? "admin" : "consultor";
    if (nome.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return json({ erro: "Informe nome e e-mail válido." }, 400);
    if (senha.length < 8) return json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);
    const pn = await fetch(`${base}/rest/v1/perfis?select=id,nome`, { headers: svc });
    const todos = pn.ok ? ((await pn.json()) as { id: string; nome: string }[]) : [];
    if (todos.some((p) => p.nome.toLowerCase() === nome.toLowerCase()))
      return json({ erro: "Já existe uma pessoa com este nome." }, 400);
    const cr = await fetch(`${base}/auth/v1/admin/users`, {
      method: "POST",
      headers: svc,
      body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { nome } }),
    });
    const novo = (await cr.json().catch(() => ({}))) as {
      id?: string;
      msg?: string;
      message?: string;
      error_code?: string;
    };
    if (!cr.ok || !novo.id) {
      const txt = `${novo.msg ?? ""} ${novo.message ?? ""} ${novo.error_code ?? ""}`;
      return json(
        {
          erro: /already|registered|exists/i.test(txt)
            ? "Já existe um acesso com este e-mail."
            : /password|weak/i.test(txt)
              ? "Escolha uma senha mais forte (letras e números)."
              : "Não foi possível criar o acesso.",
        },
        400,
      );
    }
    const up = await fetch(`${base}/rest/v1/perfis?id=eq.${novo.id}`, {
      method: "PATCH",
      headers: { ...svc, Prefer: "return=minimal" },
      body: JSON.stringify({ nome, papel, status: "ativo", whatsapp: String(corpo["whatsapp"] ?? "").trim() || null }),
    });
    if (!up.ok) return json({ erro: "Acesso criado, mas não foi possível ativar. Aprove na lista de pedidos." }, 500);
    return json({ ok: true, id: novo.id });
  }

  const id = String(corpo["id"] ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ erro: "Pessoa não encontrada." }, 400);

  if (acao === "senha") {
    const senha = String(corpo["senha"] ?? "");
    if (senha.length < 8) return json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);
    const r = await fetch(`${base}/auth/v1/admin/users/${id}`, {
      method: "PUT",
      headers: svc,
      body: JSON.stringify({ password: senha }),
    });
    if (!r.ok) return json({ erro: "Não foi possível trocar a senha. Use letras e números." }, 400);
    return json({ ok: true });
  }

  if (acao === "excluir") {
    if (id === quem.id) return json({ erro: "Você não pode excluir o seu próprio acesso." }, 400);
    const r = await fetch(`${base}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
    if (!r.ok) return json({ erro: "Não foi possível excluir o acesso." }, 400);
    return json({ ok: true });
  }

  return json({ erro: "Ação desconhecida." }, 400);
}
