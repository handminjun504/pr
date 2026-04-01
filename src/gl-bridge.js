/**
 * index.html 인라인 스크립트와 PocketBase(gl) 연결
 */
import '../env.js';
import * as db from '../lib/gl-db.js';

function showHeaderGl(connected) {
  const header = document.querySelector('.header-actions');
  if (!header) return;
  const old = header.querySelector('.connection-status');
  if (old) old.remove();
  const el = document.createElement('span');
  el.className = 'connection-status';
  el.style.cssText = `
    font-size: 11px; padding: 4px 10px; border-radius: 12px; color: white;
    background: ${connected ? '#27ae60' : 'rgba(255,255,255,0.15)'};
  `;
  el.textContent = connected ? 'GL 연결됨' : '로컬';
  header.prepend(el);
}

async function init() {
  if (!db.isConnected()) {
    document.dispatchEvent(new CustomEvent('gc:disabled'));
    return;
  }

  const status = await db.checkConnection();
  if (!status.connected) {
    console.warn('PocketBase 연결 실패:', status.error);
    document.dispatchEvent(new CustomEvent('gc:disabled', { detail: status.error }));
    showHeaderGl(false);
    return;
  }

  document.dispatchEvent(new CustomEvent('gc:connected'));
  showHeaderGl(true);

  try {
    const services = await db.getServices();
    document.dispatchEvent(new CustomEvent('gc:serviceData', { detail: services }));
  } catch (e) {
    console.warn('서비스 목록 로드 실패:', e);
  }

  window.glManualSave = async () => {
    const companyName = document.getElementById('companyName')?.value.trim();
    if (!companyName) throw new Error('기업명을 입력해주세요');

    let clientId = window.gcCurrentClientId;
    if (!clientId) {
      const client = await db.createProposalClient({
        company_name: companyName,
        contact_name: document.getElementById('contactName')?.value.trim() || null,
        industry_type: document.getElementById('industryType')?.value || null
      });
      clientId = client.id;
      window.gcCurrentClientId = clientId;
    }

    const customContent = {};
    document.querySelectorAll('#documentContent [data-key]').forEach((el) => {
      const key = el.getAttribute('data-key');
      if (key) customContent[key] = el.innerHTML;
    });

    const proposalData = {
      client_id: clientId,
      title: `${companyName} 서비스 제안서`,
      include_existing_staff: document.getElementById('optExistingStaff')?.checked || false,
      include_erp_promo: document.getElementById('optErpPromo')?.checked !== false,
      custom_content: customContent
    };

    let proposal;
    if (window.gcCurrentProposalId) {
      proposal = await db.updateProposal(window.gcCurrentProposalId, proposalData);
    } else {
      proposal = await db.createProposal(proposalData);
      window.gcCurrentProposalId = proposal.id;
    }

    const selections = [];
    window.requestedServices.forEach((serviceId) => {
      selections.push({ service_id: serviceId, selection_type: 'requested' });
    });
    window.recommendedServices.forEach((serviceId) => {
      selections.push({ service_id: serviceId, selection_type: 'recommended' });
    });
    await db.saveServiceSelections(proposal.id, selections);

    if (typeof window.saveAllContent === 'function') window.saveAllContent();
  };
}

init().catch((e) => console.error('gl-bridge', e));
