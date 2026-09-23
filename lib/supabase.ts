import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur uniquement, avec la clé service_role.
 * Ne jamais importer ce fichier dans un composant client.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans les variables d'environnement."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
