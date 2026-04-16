// ═══ TAGS — Data access for tag CRUD + assignments ═══
import { supabase } from './supabase';

export async function saveTag(tag: { id?: string; sala: string; name: string; color: string }): Promise<any> {
  try {
    if (tag.id) {
      const { data } = await supabase.from('tags').update({ name: tag.name, color: tag.color }).eq('id', tag.id).select().single();
      return data;
    } else {
      const { data } = await supabase.from('tags').insert({ sala: tag.sala, name: tag.name, color: tag.color || '#007AFF' }).select().single();
      return data;
    }
  } catch { return null; }
}

export async function deleteTag(id: string): Promise<void> {
  try {
    await supabase.from('tag_assignments').delete().eq('tag_id', id);
    await supabase.from('tags').delete().eq('id', id);
  } catch {}
}

export async function toggleTagAssignment(tagId: string, entityType: string, entityId: string, sala: string): Promise<boolean> {
  try {
    const { data: ex } = await supabase.from('tag_assignments')
      .select('id').eq('tag_id', tagId).eq('entity_type', entityType).eq('entity_id', entityId).maybeSingle();
    if (ex?.id) {
      await supabase.from('tag_assignments').delete().eq('id', ex.id);
      return false; // removed
    } else {
      await supabase.from('tag_assignments').insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId, sala });
      return true; // added
    }
  } catch { return false; }
}
