import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Variáveis de ambiente da função não configuradas.",
        }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sem token." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: callerProfile, error: callerError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, professor_id, is_active")
      .eq("id", user.id)
      .single();

    if (callerError || !callerProfile || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: "Profile do chamador não encontrado." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body = await req.json();

    const {
      name,
      email,
      password,
      role,
      professor_id,
      cpf,
      phone,
      institution,
      city,
      state,
      birth_date,
    } = body;

    if (
      !name ||
      !email ||
      !password ||
      !role ||
      !cpf ||
      !phone ||
      !institution ||
      !city ||
      !state ||
      !birth_date
    ) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (callerProfile.role === "ALUNO") {
      return new Response(JSON.stringify({ error: "Aluno não pode criar usuários." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (callerProfile.role === "PROFESSOR" && role !== "ALUNO") {
      return new Response(JSON.stringify({ error: "Professor só pode criar aluno." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    let finalProfessorId: string | null = null;

    if (role === "ALUNO") {
      if (callerProfile.role === "PROFESSOR") {
        finalProfessorId = callerProfile.id;
      } else if (callerProfile.role === "ADMIN") {
        if (!professor_id) {
          return new Response(JSON.stringify({ error: "Aluno precisa de professor_id." }), {
            status: 400,
            headers: corsHeaders,
          });
        }
        finalProfessorId = professor_id;
      }
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedCpf = onlyDigits(String(cpf));
    const normalizedPhone = String(phone).trim();
    const normalizedInstitution = String(institution).trim();
    const normalizedCity = String(city).trim();
    const normalizedState = String(state).trim().toUpperCase();
    const normalizedBirthDate = String(birth_date).trim();

    if (normalizedCpf.length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: existingCpf } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cpf", normalizedCpf)
      .maybeSingle();

    if (existingCpf) {
      return new Response(JSON.stringify({ error: "CPF já cadastrado." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (createAuthError || !createdAuth.user) {
      return new Response(
        JSON.stringify({ error: createAuthError?.message || "Erro ao criar auth user." }),
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: createdAuth.user.id,
      name: String(name).trim(),
      email: normalizedEmail,
      role,
      professor_id: finalProfessorId,
      cpf: normalizedCpf,
      phone: normalizedPhone,
      institution: normalizedInstitution,
      city: normalizedCity,
      state: normalizedState,
      birth_date: normalizedBirthDate,
      created_by: callerProfile.id,
      is_active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);

      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        message: "Usuário criado com sucesso.",
        user: {
          id: createdAuth.user.id,
          name: String(name).trim(),
          email: normalizedEmail,
          role,
          professor_id: finalProfessorId,
          cpf: normalizedCpf,
          phone: normalizedPhone,
          institution: normalizedInstitution,
          city: normalizedCity,
          state: normalizedState,
          birth_date: normalizedBirthDate,
        },
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno." }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});