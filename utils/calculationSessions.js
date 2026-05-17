import { supabase } from './supabase';

export function getCalculationSessionErrorMessage(error, fallbackMessage) {
    if (error?.code === 'PGRST205') {
        return "저장 테이블이 아직 없습니다. Supabase SQL Editor에서 'supabase/calculation_sessions.sql'을 먼저 실행해주세요.";
    }

    return fallbackMessage;
}

export async function listCalculationSessions() {
    return supabase
        .from('calculation_sessions')
        .select('id, title, source_data, calculator_state, created_at, updated_at')
        .order('updated_at', { ascending: false });
}

export async function getCalculationSessionById(sessionId) {
    return supabase
        .from('calculation_sessions')
        .select('id, title, source_data, calculator_state, created_at, updated_at')
        .eq('id', sessionId)
        .single();
}

export async function saveCalculationSession({ sessionId, userId, title, sourceData, calculatorState }) {
    const payload = {
        user_id: userId,
        title,
        source_data: sourceData,
        calculator_state: calculatorState,
    };

    if (sessionId) {
        return supabase
            .from('calculation_sessions')
            .update(payload)
            .eq('id', sessionId)
            .select('id')
            .single();
    }

    return supabase
        .from('calculation_sessions')
        .insert(payload)
        .select('id')
        .single();
}

export async function renameCalculationSession(sessionId, title) {
    return supabase
        .from('calculation_sessions')
        .update({ title })
        .eq('id', sessionId)
        .select('id')
        .single();
}

export async function duplicateCalculationSession({ userId, title, sourceData, calculatorState }) {
    return supabase
        .from('calculation_sessions')
        .insert({
            user_id: userId,
            title,
            source_data: sourceData,
            calculator_state: calculatorState,
        })
        .select('id')
        .single();
}

export async function deleteCalculationSession(sessionId) {
    return supabase.from('calculation_sessions').delete().eq('id', sessionId);
}
