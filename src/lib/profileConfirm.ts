import { supabase } from './supabase'

// Lembrete "Suas informações ainda estão atualizadas?" (docs/DECISIONS.md 2026-10-13).
// Tudo best-effort e em UPDATE separado: se a migration 20261015100000 ainda não foi
// aplicada (coluna inexistente) o erro é ignorado — salvar a ficha nunca falha por isso.

// "Está tudo certo": grava só a data da confirmação.
export async function confirmProfile(companyId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('companies').update({ profile_confirmed_at: new Date().toISOString() }).eq('id', companyId)
    return !error
  } catch { return false }
}

// Ficha salva = confirmação + marca que a ficha mudou (o aviso da tela de Estratégia).
export async function markProfileSaved(companyId: string): Promise<void> {
  const now = new Date().toISOString()
  try { await supabase.from('companies').update({ profile_confirmed_at: now, profile_changed_at: now }).eq('id', companyId) } catch { /* coluna ausente: ignora */ }
}
