/**
 * Supabase 클라이언트 설정
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 환경 변수에서 Supabase 설정 가져오기
const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || '';

// Supabase 클라이언트 생성
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// 연결 상태 확인
export async function checkConnection() {
    if (!supabase) {
        return { connected: false, error: 'Supabase가 설정되지 않았습니다' };
    }
    
    try {
        const { error } = await supabase.from('proposal_services').select('count', { count: 'exact', head: true });
        if (error) throw error;
        return { connected: true };
    } catch (error) {
        return { connected: false, error: error.message };
    }
}

// ============================================
// 서비스 관련 함수
// ============================================

/**
 * 모든 활성 서비스 가져오기
 */
export async function getServices() {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
    
    if (error) throw error;
    
    // service_id를 키로 하는 객체로 변환
    return data.reduce((acc, service) => {
        acc[service.service_id] = service;
        return acc;
    }, {});
}

// ============================================
// 고객사 관련 함수
// ============================================

/**
 * 고객사 생성
 */
export async function createProposalClient(clientData) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_clients')
        .insert([clientData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * 고객사 검색
 */
export async function searchClients(searchTerm) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_clients')
        .select('*')
        .or(`company_name.ilike.%${searchTerm}%,contact_name.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) throw error;
    return data;
}

/**
 * 모든 고객사 목록
 */
export async function getAllClients() {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_clients')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
}

// ============================================
// 제안서 관련 함수
// ============================================

/**
 * 제안서 생성
 */
export async function createProposal(proposalData) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposals')
        .insert([proposalData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * 제안서 업데이트
 */
export async function updateProposal(proposalId, updates) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', proposalId)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * 제안서 목록 가져오기
 */
export async function getProposals(filters = {}) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    let query = supabase
        .from('proposals')
        .select(`
            *,
            client:proposal_clients(*)
        `)
        .order('created_at', { ascending: false });
    
    if (filters.status) {
        query = query.eq('status', filters.status);
    }
    
    if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data;
}

/**
 * 특정 제안서 가져오기
 */
export async function getProposal(proposalId) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposals')
        .select(`
            *,
            client:proposal_clients(*),
            selections:proposal_service_selections(*)
        `)
        .eq('id', proposalId)
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * 제안서 삭제
 */
export async function deleteProposal(proposalId) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', proposalId);
    
    if (error) throw error;
}

// ============================================
// 서비스 선택 관련 함수
// ============================================

/**
 * 서비스 선택 저장
 */
export async function saveServiceSelections(proposalId, selections) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    // 기존 선택 삭제
    await supabase
        .from('proposal_service_selections')
        .delete()
        .eq('proposal_id', proposalId);
    
    // 새 선택 삽입
    if (selections.length > 0) {
        const { data, error } = await supabase
            .from('proposal_service_selections')
            .insert(selections.map(s => ({ ...s, proposal_id: proposalId })))
            .select();
        
        if (error) throw error;
        return data;
    }
    
    return [];
}

/**
 * 제안서의 서비스 선택 가져오기
 */
export async function getServiceSelections(proposalId) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_service_selections')
        .select('*')
        .eq('proposal_id', proposalId);
    
    if (error) throw error;
    return data;
}

// ============================================
// 템플릿 관련 함수
// ============================================

/**
 * 템플릿 생성
 */
export async function createTemplate(templateData) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_templates')
        .insert([templateData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * 모든 템플릿 가져오기
 */
export async function getTemplates() {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { data, error } = await supabase
        .from('proposal_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('usage_count', { ascending: false });
    
    if (error) throw error;
    return data;
}

/**
 * 템플릿 사용 횟수 증가
 */
export async function incrementTemplateUsage(templateId) {
    if (!supabase) throw new Error('Supabase 미연결');
    
    const { error } = await supabase.rpc('increment_template_usage', { template_id: templateId });
    
    if (error) {
        // rpc가 없으면 수동으로 증가
        const { data: template } = await supabase
            .from('proposal_templates')
            .select('usage_count')
            .eq('id', templateId)
            .single();
        
        if (template) {
            await supabase
                .from('proposal_templates')
                .update({ usage_count: template.usage_count + 1 })
                .eq('id', templateId);
        }
    }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * Supabase 연결 여부 확인
 */
export function isConnected() {
    return supabase !== null;
}

/**
 * 에러 메시지 포맷팅
 */
export function formatError(error) {
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return '알 수 없는 오류가 발생했습니다';
}
