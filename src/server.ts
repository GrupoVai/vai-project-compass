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
      if (caminho === "/api/arquivos") return await arquivosEquipe(request);
      if (caminho === "/api/arquivo") return await arquivoCliente(request);
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

/* ===================== arquivos dos entregáveis =====================
   Storage privado (bucket "entregaveis", caminho <projeto>/<arquivo>).
   PUT/DELETE /api/arquivos?p=&a=  → time (login), só em projeto que a pessoa enxerga (regras do banco)
   GET /api/arquivo?t=&a=          → download pelo token do link do cliente (time e cliente) */
const BUCKET = "entregaveis";
const SB_PUB = "sb_publishable_dfh93Pu8sC5532QLEmz38Q_bx-Kh8LC";
function cfgBanco() {
  const base = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!base || !key) return null;
  const svc: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_")) svc["Authorization"] = `Bearer ${key}`;
  return { base, svc };
}
const jsonR = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function arquivosEquipe(request: Request): Promise<Response> {
  const cfg = cfgBanco();
  if (!cfg) return jsonR({ erro: "Servidor sem configuração do banco." }, 500);
  const u = new URL(request.url);
  const pid = u.searchParams.get("p") ?? "",
    aid = u.searchParams.get("a") ?? "";
  if (!/^\d{1,20}$/.test(pid) || !/^a\d{1,24}$/.test(aid)) return jsonR({ erro: "Pedido inválido." }, 400);
  const jwt = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonR({ erro: "Faça login de novo." }, 401);
  // a pessoa precisa enxergar o projeto (as regras do banco decidem)
  const vr = await fetch(`${cfg.base}/rest/v1/registros?select=id&colecao=eq.projetos&id=eq.${pid}`, {
    headers: { apikey: SB_PUB, Authorization: `Bearer ${jwt}` },
  });
  if (vr.status === 401) return jsonR({ erro: "Faça login de novo." }, 401);
  const vis = vr.ok ? ((await vr.json()) as unknown[]) : [];
  if (!vis.length)
    return jsonR(
      { erro: "Sem acesso a este projeto (ou o projeto ainda está sendo salvo, tente de novo em instantes)." },
      403,
    );
  const obj = `${cfg.base}/storage/v1/object/${BUCKET}/${pid}/${aid}`;

  if (request.method === "DELETE") {
    await fetch(`${cfg.base}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...cfg.svc, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [`${pid}/${aid}`] }),
    });
    return jsonR({ ok: true });
  }
  if (request.method !== "PUT") return jsonR({ erro: "Método não permitido." }, 405);
  const corpo = await request.arrayBuffer();
  if (!corpo.byteLength) return jsonR({ erro: "Arquivo vazio." }, 400);
  if (corpo.byteLength > 50 * 1024 * 1024) return jsonR({ erro: "Cada arquivo pode ter até 50 MB." }, 413);
  const tipo = request.headers.get("content-type") || "application/octet-stream";
  const enviar = () =>
    fetch(obj, { method: "POST", headers: { ...cfg.svc, "content-type": tipo, "x-upsert": "true" }, body: corpo });
  let r = await enviar();
  if (!r.ok) {
    const t = await r.text();
    {
      // primeiro envio: cria o bucket privado (se já existir, a criação só é ignorada) e tenta de novo
      await fetch(`${cfg.base}/storage/v1/bucket`, {
        method: "POST",
        headers: { ...cfg.svc, "content-type": "application/json" },
        body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 52428800 }),
      });
      r = await enviar();
    }
    if (!r.ok) {
      console.error("storage upload", r.status, t);
      return jsonR({ erro: "Não foi possível guardar o arquivo. Tente de novo." }, 502);
    }
  }
  return jsonR({ ok: true });
}

type Arq = { id?: string; nome?: string; tipo?: string };
async function arquivoCliente(request: Request): Promise<Response> {
  const txt = (m: string, status: number) =>
    new Response(m, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const cfg = cfgBanco();
  if (!cfg) return txt("Servidor sem configuração do banco.", 500);
  const u = new URL(request.url);
  const tok = u.searchParams.get("t") ?? "",
    aid = u.searchParams.get("a") ?? "";
  if (!/^[a-z0-9]{16,64}$/i.test(tok) || !/^a\d{1,24}$/.test(aid)) return txt("Link inválido.", 400);
  const pr = await fetch(
    `${cfg.base}/rest/v1/registros?select=id,dados&colecao=eq.projetos&dados->>token=eq.${encodeURIComponent(tok)}&limit=1`,
    { headers: cfg.svc },
  );
  const proj = pr.ok
    ? ((await pr.json()) as { id: number; dados: { ec?: { entregaveis?: { arquivos?: Arq[] }[] } } }[])[0]
    : undefined;
  if (!proj) return txt("Link inválido ou renovado. Peça o link atualizado ao seu consultor.", 404);
  let achou: Arq | undefined;
  for (const x of proj.dados.ec?.entregaveis ?? []) {
    achou = (x.arquivos ?? []).find((a) => a.id === aid);
    if (achou) break;
  }
  if (!achou) return txt("Este arquivo foi removido do projeto.", 404);
  const r = await fetch(`${cfg.base}/storage/v1/object/authenticated/${BUCKET}/${proj.id}/${aid}`, {
    headers: cfg.svc,
  });
  if (!r.ok || !r.body) return txt("Arquivo não encontrado.", 404);
  const nome = String(achou.nome || "arquivo").replace(/[\r\n"]/g, "");
  const ascii =
    nome
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/[\\;]/g, "") || "arquivo";
  return new Response(r.body, {
    headers: {
      "content-type": achou.tipo || r.headers.get("content-type") || "application/octet-stream",
      "content-disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
