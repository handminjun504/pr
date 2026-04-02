/**
 * gl-server PocketBase 연동 (gc_* 컬렉션)
 * 브라우저는 window.ENV.POCKETBASE_URL(Vite 빌드 시 주입)로 접속합니다.
 */

import PocketBase from 'pocketbase';

const PB_URL = (typeof window !== 'undefined' && window.ENV?.POCKETBASE_URL) || '';
const COL = {
  services: 'gc_proposal_services',
  clients: 'gc_proposal_clients',
  proposals: 'gc_proposals',
  selections: 'gc_proposal_service_selections',
  templates: 'gc_proposal_templates'
};

export const pb = PB_URL ? new PocketBase(PB_URL) : null;

let _serviceIdToRecordId = new Map();

async function refreshServiceIndex() {
  _serviceIdToRecordId = new Map();
  if (!pb) return;
  const list = await pb.collection(COL.services).getFullList({
    filter: 'is_active = true',
    sort: 'sort_order'
  });
  for (const r of list) {
    if (r.service_id) _serviceIdToRecordId.set(r.service_id, r.id);
  }
}

export async function checkConnection() {
  if (!pb) {
    return { connected: false, error: 'PocketBase URL이 설정되지 않았습니다 (VITE_POCKETBASE_URL)' };
  }
  try {
    await pb.collection(COL.services).getList(1, 1);
    await refreshServiceIndex();
    return { connected: true };
  } catch (e) {
    return { connected: false, error: e.message || String(e) };
  }
}

export async function getServices() {
  if (!pb) throw new Error('PocketBase 미연결');
  const list = await pb.collection(COL.services).getFullList({
    filter: 'is_active = true',
    sort: 'sort_order'
  });
  await refreshServiceIndex();
  return list.reduce((acc, row) => {
    let imageUrl = row.image_url || row.illustration_url;
    if (!imageUrl && row.illustration && pb) {
      imageUrl = pb.files.getURL(row, row.illustration);
    }
    acc[row.service_id] = {
      service_id: row.service_id,
      category: row.category,
      title: row.title,
      icon: row.icon,
      method: row.method,
      detail: row.detail,
      effect: row.effect,
      sample: row.sample,
      is_active: row.is_active,
      sort_order: row.sort_order,
      ...(imageUrl ? { image_url: imageUrl } : {})
    };
    return acc;
  }, {});
}

export async function createProposalClient(clientData) {
  if (!pb) throw new Error('PocketBase 미연결');
  return pb.collection(COL.clients).create({
    company_name: clientData.company_name,
    contact_name: clientData.contact_name || '',
    industry_type: clientData.industry_type || '',
    phone: clientData.phone || '',
    email: clientData.email || ''
  });
}

export async function searchClients(searchTerm) {
  if (!pb) throw new Error('PocketBase 미연결');
  const q = searchTerm.replace(/"/g, '\\"');
  const filter = `company_name ~ "${q}" || contact_name ~ "${q}"`;
  return pb.collection(COL.clients).getFullList({
    filter,
    sort: '-created'
  });
}

export async function getAllClients() {
  if (!pb) throw new Error('PocketBase 미연결');
  return pb.collection(COL.clients).getFullList({ sort: '-created' });
}

function mapProposalRow(r, expand) {
  const client = expand?.client || null;
  return {
    id: r.id,
    client_id: r.client,
    title: r.title,
    status: r.status,
    include_existing_staff: r.include_existing_staff,
    include_erp_promo: r.include_erp_promo,
    custom_content: r.custom_content || {},
    pdf_url: r.pdf_url,
    created_at: r.created,
    updated_at: r.updated,
    sent_at: r.sent_at,
    client: client
      ? {
          id: client.id,
          company_name: client.company_name,
          contact_name: client.contact_name,
          industry_type: client.industry_type
        }
      : null
  };
}

export async function createProposal(proposalData) {
  if (!pb) throw new Error('PocketBase 미연결');
  const body = {
    client: proposalData.client_id,
    title: proposalData.title,
    status: proposalData.status || 'draft',
    include_existing_staff: proposalData.include_existing_staff ?? false,
    include_erp_promo: proposalData.include_erp_promo ?? true,
    custom_content: proposalData.custom_content || {},
    pdf_url: proposalData.pdf_url || '',
    sent_at: proposalData.sent_at || null
  };
  const r = await pb.collection(COL.proposals).create(body);
  return mapProposalRow(r, null);
}

export async function updateProposal(proposalId, updates) {
  if (!pb) throw new Error('PocketBase 미연결');
  const body = { ...updates };
  if (updates.client_id != null) {
    body.client = updates.client_id;
    delete body.client_id;
  }
  const r = await pb.collection(COL.proposals).update(proposalId, body);
  return mapProposalRow(r, null);
}

export async function getProposals(filters = {}) {
  if (!pb) throw new Error('PocketBase 미연결');
  const parts = [];
  if (filters.status) parts.push(`status = "${filters.status}"`);
  if (filters.clientId) parts.push(`client = "${filters.clientId}"`);
  const filter = parts.length ? parts.join(' && ') : '';
  const list = await pb.collection(COL.proposals).getFullList({
    filter,
    sort: '-created',
    expand: 'client'
  });
  return list.map((r) => mapProposalRow(r, r.expand));
}

export async function getProposal(proposalId) {
  if (!pb) throw new Error('PocketBase 미연결');
  const r = await pb.collection(COL.proposals).getOne(proposalId, { expand: 'client' });
  const selections = await pb.collection(COL.selections).getFullList({
    filter: `proposal = "${proposalId}"`,
    expand: 'service'
  });
  const mapped = mapProposalRow(r, r.expand);
  mapped.selections = selections.map((s) => ({
    id: s.id,
    proposal_id: s.proposal,
    service_id: s.expand?.service?.service_id || s.service,
    selection_type: s.selection_type,
    custom_title: s.custom_title,
    custom_method: s.custom_method,
    custom_detail: s.custom_detail,
    custom_effect: s.custom_effect
  }));
  return mapped;
}

export async function deleteProposal(proposalId) {
  if (!pb) throw new Error('PocketBase 미연결');
  await pb.collection(COL.proposals).delete(proposalId);
}

export async function saveServiceSelections(proposalId, selections) {
  if (!pb) throw new Error('PocketBase 미연결');
  await refreshServiceIndex();
  const existing = await pb.collection(COL.selections).getFullList({
    filter: `proposal = "${proposalId}"`
  });
  for (const row of existing) {
    await pb.collection(COL.selections).delete(row.id);
  }
  const out = [];
  for (const s of selections) {
    const sid = _serviceIdToRecordId.get(s.service_id);
    if (!sid) continue;
    const row = await pb.collection(COL.selections).create({
      proposal: proposalId,
      service: sid,
      selection_type: s.selection_type,
      custom_title: s.custom_title || '',
      custom_method: s.custom_method || '',
      custom_detail: s.custom_detail || '',
      custom_effect: s.custom_effect || ''
    });
    out.push(row);
  }
  return out;
}

export async function getServiceSelections(proposalId) {
  if (!pb) throw new Error('PocketBase 미연결');
  const list = await pb.collection(COL.selections).getFullList({
    filter: `proposal = "${proposalId}"`,
    expand: 'service'
  });
  return list.map((s) => ({
    id: s.id,
    proposal_id: s.proposal,
    service_id: s.expand?.service?.service_id,
    selection_type: s.selection_type,
    custom_title: s.custom_title,
    custom_method: s.custom_method,
    custom_detail: s.custom_detail,
    custom_effect: s.custom_effect
  }));
}

export async function createTemplate(templateData) {
  if (!pb) throw new Error('PocketBase 미연결');
  return pb.collection(COL.templates).create({
    name: templateData.name,
    payload: templateData.payload || {},
    is_default: templateData.is_default ?? false,
    usage_count: templateData.usage_count ?? 0
  });
}

export async function getTemplates() {
  if (!pb) throw new Error('PocketBase 미연결');
  return pb.collection(COL.templates).getFullList({ sort: '-created' });
}

export async function incrementTemplateUsage(templateId) {
  if (!pb) throw new Error('PocketBase 미연결');
  const t = await pb.collection(COL.templates).getOne(templateId);
  await pb.collection(COL.templates).update(templateId, {
    usage_count: (t.usage_count || 0) + 1
  });
}

export function isConnected() {
  return Boolean(PB_URL);
}

export function formatError(error) {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.data?.message) return error.data.message;
  return '알 수 없는 오류가 발생했습니다';
}
