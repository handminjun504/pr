/**
 * 경리업무를잘하는청년들 - 서비스 소개서 생성기 (PocketBase / gl 연동 — 모듈 엔트리용)
 */

import {
    isConnected,
    checkConnection,
    getServices,
    createProposalClient,
    searchClients,
    createProposal,
    updateProposal,
    getProposals,
    saveServiceSelections,
    formatError
} from './lib/gl-db.js';

// ============================================
// 전역 상태 관리
// ============================================

const AppState = {
    requestedServices: new Set(),  // 고객 요청 서비스
    recommendedServices: new Set(), // 경청 추천 서비스
    isEditMode: false,
    saveTimeout: null,
    serviceData: null,
    defaultServiceData: null,
    currentProposalId: null, // 현재 편집 중인 제안서 ID
    currentClientId: null,    // 현재 선택된 고객사 ID
    useGl: false // PocketBase(gl) 연결 성공 시 true
};

// ============================================
// 초기화
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // PocketBase(gl) 연결 확인
        if (isConnected()) {
            const connectionStatus = await checkConnection();
            if (connectionStatus.connected) {
                AppState.useGl = true;
                await loadServiceDataFromGl();
                showToast('GL 연결됨', 'success');
                updateConnectionStatus(true);
            } else {
                console.warn('PocketBase 연결 실패:', connectionStatus.error);
                await loadServiceDataLocal();
                showToast('💾 로컬 모드로 실행 중', 'info');
                updateConnectionStatus(false);
            }
        } else {
            await loadServiceDataLocal();
            updateConnectionStatus(false);
        }
        
        updateSelectionCount();
        loadSavedData();
        
        // 고객사 검색 이벤트 추가
        setupClientSearch();
        
        // 제안서 목록 로드 (GL 연결 시)
        if (AppState.useGl) {
            await loadProposalsList();
        }
    } catch (error) {
        console.error('초기화 오류:', error);
        showToast('초기화 중 오류가 발생했습니다', 'error');
        await loadServiceDataLocal(); // 폴백
    }
});

// ============================================
// 연결 상태 표시
// ============================================

function updateConnectionStatus(connected) {
    const header = document.querySelector('.header-actions');
    if (!header) return;
    
    const existingStatus = header.querySelector('.connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    const statusEl = document.createElement('span');
    statusEl.className = 'connection-status';
    statusEl.style.cssText = `
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 12px;
        background: ${connected ? '#27ae60' : 'rgba(255,255,255,0.1)'};
        color: white;
    `;
    statusEl.textContent = connected ? 'GL' : '💾 Local';
    header.prepend(statusEl);
}

// ============================================
// 서비스 데이터 로드
// ============================================

async function loadServiceDataFromGl() {
    try {
        const data = await getServices();
        AppState.defaultServiceData = JSON.parse(JSON.stringify(data));
        
        // 저장된 커스텀 데이터가 있으면 병합
        const savedServiceData = localStorage.getItem('serviceData');
        if (savedServiceData) {
            const customData = JSON.parse(savedServiceData);
            AppState.serviceData = { ...data, ...customData };
        } else {
            AppState.serviceData = data;
        }
        
        console.log('✅ GL에서 서비스 데이터 로드 완료');
    } catch (error) {
        console.error('GL 데이터 로드 실패:', error);
        throw error;
    }
}

async function loadServiceDataLocal() {
    try {
        const response = await fetch('services-data.json');
        if (!response.ok) {
            throw new Error('서비스 데이터를 불러올 수 없습니다');
        }
        const data = await response.json();
        AppState.defaultServiceData = JSON.parse(JSON.stringify(data));
        
        const savedServiceData = localStorage.getItem('serviceData');
        AppState.serviceData = savedServiceData ? JSON.parse(savedServiceData) : JSON.parse(JSON.stringify(data));
        
        console.log('✅ 로컬 파일에서 서비스 데이터 로드 완료');
    } catch (error) {
        console.error('로컬 데이터 로드 실패:', error);
        AppState.serviceData = getFallbackServiceData();
        AppState.defaultServiceData = JSON.parse(JSON.stringify(AppState.serviceData));
    }
}

function getFallbackServiceData() {
    return {
        accountManagement: {
            category: '기본 관리',
            title: '사업용 계좌관리',
            icon: '🏦',
            method: '사업용 계좌의 입출금 내역을 실시간으로 모니터링하고, 거래 유형별로 분류하여 관리합니다.',
            detail: '• 계좌별 입출금 현황 일일/주간/월간 리포트 제공\n• 이체 내역과 세금계산서/카드매출 자동 매칭\n• 미확인 입금 알림 및 추적 관리',
            effect: '자금 흐름을 투명하게 파악하고, 회계 처리 누락을 방지합니다.',
            sample: '📊 제공 보고서: 계좌별 잔액현황표, 일일 입출금 명세서'
        }
    };
}

// ============================================
// 고객사 검색 기능
// ============================================

function setupClientSearch() {
    const companyInput = document.getElementById('companyName');
    if (!companyInput || !AppState.useGl) return;
    
    let searchTimeout;
    const searchResults = document.createElement('div');
    searchResults.className = 'client-search-results';
    searchResults.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid var(--border);
        border-radius: 6px;
        max-height: 200px;
        overflow-y: auto;
        display: none;
        z-index: 10;
        box-shadow: var(--shadow);
    `;
    
    const wrapper = companyInput.parentElement;
    wrapper.style.position = 'relative';
    wrapper.appendChild(searchResults);
    
    companyInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const clients = await searchClients(query);
                displaySearchResults(clients, searchResults, companyInput);
            } catch (error) {
                console.error('검색 오류:', error);
            }
        }, 300);
    });
    
    // 외부 클릭 시 검색 결과 숨기기
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function displaySearchResults(clients, resultsEl, inputEl) {
    if (clients.length === 0) {
        resultsEl.innerHTML = '<div style="padding: 10px; color: var(--text-light);">검색 결과 없음</div>';
        resultsEl.style.display = 'block';
        return;
    }
    
    resultsEl.innerHTML = clients.map(client => `
        <div class="search-result-item" data-client-id="${client.id}" style="
            padding: 10px 14px;
            cursor: pointer;
            border-bottom: 1px solid var(--border-light);
            transition: background 0.2s;
        ">
            <div style="font-weight: 600; color: var(--navy);">${client.company_name}</div>
            <div style="font-size: 12px; color: var(--text-light);">
                ${client.contact_name || ''} ${client.industry_type ? `· ${client.industry_type}` : ''}
            </div>
        </div>
    `).join('');
    
    resultsEl.style.display = 'block';
    
    // 검색 결과 클릭 이벤트
    resultsEl.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('mouseenter', (e) => {
            e.target.style.background = 'var(--navy-pale)';
        });
        item.addEventListener('mouseleave', (e) => {
            e.target.style.background = '';
        });
        item.addEventListener('click', () => {
            const clientId = item.dataset.clientId;
            const client = clients.find(c => c.id == clientId);
            if (client) {
                selectClient(client);
                resultsEl.style.display = 'none';
            }
        });
    });
}

function selectClient(client) {
    AppState.currentClientId = client.id;
    document.getElementById('companyName').value = client.company_name;
    if (client.contact_name) {
        document.getElementById('contactName').value = client.contact_name;
    }
    if (client.industry_type) {
        document.getElementById('industryType').value = client.industry_type;
    }
    updatePreview();
    showToast(`✅ ${client.company_name} 선택됨`, 'success');
}

// ============================================
// 제안서 목록 관리
// ============================================

async function loadProposalsList() {
    if (!AppState.useGl) return;
    
    try {
        const proposals = await getProposals();
        // 제안서 목록 UI 업데이트 (추후 구현)
        console.log('제안서 목록:', proposals);
    } catch (error) {
        console.error('제안서 목록 로드 실패:', error);
    }
}

// ============================================
// 로컬 스토리지 관리 (로컬 모드 또는 백업)
// ============================================

function loadSavedData() {
    let hasData = false;
    
    const savedContent = localStorage.getItem('editedContent');
    if (savedContent) {
        try {
            const content = JSON.parse(savedContent);
            window.savedEditContent = content;
            if (Object.keys(content).length > 0) hasData = true;
        } catch (e) {
            console.error('저장된 내용 불러오기 실패:', e);
        }
    }

    if (!AppState.useGl) {
        const savedServiceData = localStorage.getItem('serviceData');
        if (savedServiceData) {
            try {
                AppState.serviceData = JSON.parse(savedServiceData);
                hasData = true;
            } catch (e) {
                console.error('서비스 데이터 불러오기 실패:', e);
            }
        }
    }
    
    if (hasData) {
        setTimeout(() => {
            updateSaveStatus('saved');
            showToast('이전에 저장된 내용이 불러와졌습니다', 'success');
        }, 500);
    }
}

function saveEditedContent() {
    const editables = document.querySelectorAll('#documentContent [data-key]');
    const content = {};
    
    editables.forEach(el => {
        const key = el.getAttribute('data-key');
        if (key) {
            content[key] = el.innerHTML;
        }
    });
    
    localStorage.setItem('editedContent', JSON.stringify(content));
}

function applySavedContent() {
    if (window.savedEditContent) {
        Object.keys(window.savedEditContent).forEach(key => {
            const el = document.querySelector(`[data-key="${key}"]`);
            if (el) {
                el.innerHTML = window.savedEditContent[key];
            }
        });
    }
}

function saveServiceData() {
    if (!AppState.useGl) {
        localStorage.setItem('serviceData', JSON.stringify(AppState.serviceData));
    }
}

function saveAllContent() {
    saveEditedContent();
    saveServiceData();
    
    const savedContent = localStorage.getItem('editedContent');
    if (savedContent) {
        window.savedEditContent = JSON.parse(savedContent);
    }
}

// ============================================
// 자동 저장
// ============================================

function autoSave() {
    clearTimeout(AppState.saveTimeout);
    updateSaveStatus('saving');
    
    AppState.saveTimeout = setTimeout(async () => {
        saveAllContent();
        
        // GL(PocketBase)에도 저장 (현재 제안서가 있을 경우)
        if (AppState.useGl && AppState.currentProposalId) {
            try {
                await saveProposalToGl();
            } catch (error) {
                console.error('GL 저장 실패:', error);
            }
        }
        
        updateSaveStatus('saved');
    }, 1500);
}

async function saveProposalToGl() {
    if (!AppState.currentProposalId) return;
    
    const customContent = {};
    document.querySelectorAll('#documentContent [data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if (key) {
            customContent[key] = el.innerHTML;
        }
    });
    
    const proposalData = {
        include_existing_staff: document.getElementById('optExistingStaff')?.checked || false,
        include_erp_promo: document.getElementById('optErpPromo')?.checked || true,
        custom_content: customContent
    };
    
    await updateProposal(AppState.currentProposalId, proposalData);
    
    // 서비스 선택 저장
    const selections = [];
    AppState.requestedServices.forEach(serviceId => {
        selections.push({ service_id: serviceId, selection_type: 'requested' });
    });
    AppState.recommendedServices.forEach(serviceId => {
        selections.push({ service_id: serviceId, selection_type: 'recommended' });
    });
    
    await saveServiceSelections(AppState.currentProposalId, selections);
}

async function manualSave() {
    updateSaveStatus('saving');
    saveAllContent();
    
    if (AppState.useGl) {
        try {
            // 새 제안서 생성 또는 기존 제안서 업데이트
            await createOrUpdateProposal();
            showToast('GL에 저장되었습니다', 'success');
        } catch (error) {
            console.error('저장 실패:', error);
            showToast('저장 중 오류 발생: ' + formatError(error), 'error');
        }
    } else {
        showToast('💾 로컬에 저장되었습니다!', 'success');
    }
    
    updateSaveStatus('saved');
}

async function createOrUpdateProposal() {
    const companyName = document.getElementById('companyName')?.value.trim();
    if (!companyName) {
        throw new Error('기업명을 입력해주세요');
    }
    
    // 고객사 ID가 없으면 새로 생성
    if (!AppState.currentClientId) {
        const clientData = {
            company_name: companyName,
            contact_name: document.getElementById('contactName')?.value.trim() || null,
            industry_type: document.getElementById('industryType')?.value || null
        };
        
        const client = await createProposalClient(clientData);
        AppState.currentClientId = client.id;
    }
    
    const customContent = {};
    document.querySelectorAll('#documentContent [data-key]').forEach(el => {
        const key = el.getAttribute('data-key');
        if (key) {
            customContent[key] = el.innerHTML;
        }
    });
    
    const proposalData = {
        client_id: AppState.currentClientId,
        title: `${companyName} 서비스 제안서`,
        include_existing_staff: document.getElementById('optExistingStaff')?.checked || false,
        include_erp_promo: document.getElementById('optErpPromo')?.checked || true,
        custom_content: customContent
    };
    
    let proposal;
    if (AppState.currentProposalId) {
        proposal = await updateProposal(AppState.currentProposalId, proposalData);
    } else {
        proposal = await createProposal(proposalData);
        AppState.currentProposalId = proposal.id;
    }
    
    // 서비스 선택 저장
    const selections = [];
    AppState.requestedServices.forEach(serviceId => {
        selections.push({ service_id: serviceId, selection_type: 'requested' });
    });
    AppState.recommendedServices.forEach(serviceId => {
        selections.push({ service_id: serviceId, selection_type: 'recommended' });
    });
    
    await saveServiceSelections(proposal.id, selections);
    
    return proposal;
}

function updateSaveStatus(status) {
    const statusEl = document.getElementById('saveStatus');
    const textEl = document.getElementById('saveStatusText');
    
    if (!statusEl || !textEl) return;
    
    statusEl.className = 'save-status ' + status;
    
    if (status === 'saving') {
        textEl.textContent = '저장 중...';
    } else if (status === 'saved') {
        const mode = AppState.useGl ? 'GL' : '💾';
        textEl.textContent = `${mode} 저장 완료 (` + new Date().toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'}) + ')';
    } else {
        textEl.textContent = '수정 내용이 자동 저장됩니다';
    }
}

// ============================================
// 서비스 선택 관리
// ============================================

function toggleService(checkbox, serviceId, type) {
    const item = checkbox.closest('.checkbox-item');
    const targetSet = type === 'recommended' ? AppState.recommendedServices : AppState.requestedServices;
    
    if (checkbox.checked) {
        targetSet.add(serviceId);
        item.classList.add('checked');
    } else {
        targetSet.delete(serviceId);
        item.classList.remove('checked');
    }
    
    updateSelectionCount();
    updatePreview();
}

function updateSelectionCount() {
    const requestedCountEl = document.getElementById('requestedCount');
    const recommendedCountEl = document.getElementById('recommendedCount');
    
    if (requestedCountEl) {
        requestedCountEl.innerHTML = `선택: <strong>${AppState.requestedServices.size}개</strong>`;
    }
    if (recommendedCountEl) {
        recommendedCountEl.innerHTML = `선택: <strong>${AppState.recommendedServices.size}개</strong>`;
    }
}

// ============================================
// 서비스 박스 HTML 생성
// ============================================

function generateServiceBoxHTML(serviceId, data, type) {
    const typeLabel = type === 'recommended' ? '💡 경청 추천' : '📌 고객 요청';
    const typeBadgeClass = type === 'recommended' ? 'badge-recommended' : 'badge-requested';
    
    return `
        <div class="service-box ${type}" data-service-id="${serviceId}" style="page-break-inside: avoid; break-inside: avoid;">
            <div class="service-header">
                <span class="service-icon">${data.icon || '📋'}</span>
                <h4 data-editable data-key="svc_${serviceId}_title">${data.title}</h4>
                <span class="service-badge ${typeBadgeClass}">${typeLabel}</span>
            </div>
            <div class="service-body">
                <div class="info-row">
                    <span class="info-label">운영 방식</span>
                    <span class="info-value" data-editable data-key="svc_${serviceId}_method">${data.method}</span>
                </div>
                ${data.detail ? `
                <div class="info-row">
                    <span class="info-label">상세 내용</span>
                    <span class="info-value detail-text" data-editable data-key="svc_${serviceId}_detail">${data.detail.replace(/\n/g, '<br>')}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="info-label">기대 효과</span>
                    <span class="info-value" data-editable data-key="svc_${serviceId}_effect">${data.effect}</span>
                </div>
                ${data.sample ? `
                <div class="sample-report">
                    ${data.sample}
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// 나머지 함수들은 원본과 동일하게 유지...
// (updatePreview, toggleEditMode, exportToPDF, etc.)
// [이전 app.js의 해당 함수들을 그대로 사용]

// 계속...
