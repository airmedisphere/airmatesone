
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Settlement } from '@/types';
import { mapSupabaseToSettlement } from '@/utils/settlementUtils';
import { settlementSchema, checkRateLimit } from '@/utils/validation';

interface UserDetails {
  name: string;
  email: string;
  upi_id: string;
}

export const secureSettlementService = {
  async fetchSettlements(supabase: SupabaseClient, userId: string): Promise<Settlement[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[secureSettlementService] Fetching settlements for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`[secureSettlementService] Error fetching settlements:`, error);
      throw error;
    }
    
    return (data || []).map(mapSupabaseToSettlement);
  },

  async createSettlement(
    supabase: SupabaseClient,
    currentUserData: UserDetails,
    otherPartyData: UserDetails,
    amount: number,
    currentUserId: string,
    type: 'owes' | 'owed' = 'owes'
  ): Promise<Settlement> {
    // Rate limiting
    if (!checkRateLimit(`settlement_${currentUserId}`, 5, 60000)) {
      throw new Error('Too many settlement creation attempts. Please wait.');
    }

    // Validate input
    const validatedData = settlementSchema.parse({
      amount,
      name: otherPartyData.name,
      email: otherPartyData.email,
      upi_id: otherPartyData.upi_id,
      type,
    });

    // Ensure user can only create settlements for themselves
    if (!currentUserId) {
      throw new Error('Authentication required');
    }

    const transactionGroupId = uuidv4();

    const settlementData = {
      user_id: currentUserId,
      name: validatedData.name,
      email: validatedData.email.toLowerCase(),
      upi_id: validatedData.upi_id,
      type: validatedData.type,
      amount: validatedData.amount,
      status: 'pending' as const,
      transaction_group_id: transactionGroupId,
    };

    console.log("[secureSettlementService] Creating settlement:", settlementData);

    const { data, error } = await supabase
      .from('settlements')
      .insert(settlementData)
      .select()
      .single();

    if (error) {
      console.error("[secureSettlementService] Error creating settlement:", error);
      throw error;
    }

    // Try to create paired settlement for other user if they exist
    try {
      const { data: otherUserProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', validatedData.email)
        .maybeSingle();

      if (otherUserProfile && otherUserProfile.id !== currentUserId) {
        const pairedSettlement = {
          user_id: otherUserProfile.id,
          name: currentUserData.name,
          email: currentUserData.email.toLowerCase(),
          upi_id: validatedData.upi_id,
          type: type === 'owes' ? 'owed' as const : 'owes' as const,
          amount: validatedData.amount,
          status: 'pending' as const,
          transaction_group_id: transactionGroupId,
        };

        await supabase.from('settlements').insert(pairedSettlement);
      }
    } catch (error) {
      console.warn("[secureSettlementService] Could not create paired settlement:", error);
    }

    return mapSupabaseToSettlement(data);
  },

  async updateSettlementStatus(
    supabase: SupabaseClient,
    transactionGroupId: string,
    newStatus: 'pending' | 'debtor_paid' | 'settled',
    userId: string
  ): Promise<void> {
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Rate limiting
    if (!checkRateLimit(`settlement_update_${userId}`, 10, 60000)) {
      throw new Error('Too many update attempts. Please wait.');
    }

    // Verify user has permission to update this settlement
    const { data: userSettlements, error: checkError } = await supabase
      .from('settlements')
      .select('user_id, debtor_user_id, creditor_user_id')
      .eq('transaction_group_id', transactionGroupId)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (!userSettlements || userSettlements.length === 0) {
      throw new Error('Settlement not found');
    }

    const settlement = userSettlements[0];
    const hasPermission = settlement.user_id === userId || 
                         settlement.debtor_user_id === userId || 
                         settlement.creditor_user_id === userId;

    if (!hasPermission) {
      throw new Error('Unauthorized: You can only update your own settlements');
    }

    const updateData = {
      status: newStatus,
      settled_date: newStatus === 'settled' ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from('settlements')
      .update(updateData)
      .eq('transaction_group_id', transactionGroupId);

    if (error) {
      console.error(`[secureSettlementService] Error updating settlement:`, error);
      throw error;
    }
  },

  async deleteSettlement(
    supabase: SupabaseClient,
    transactionGroupId: string,
    userId: string
  ): Promise<void> {
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Rate limiting
    if (!checkRateLimit(`settlement_delete_${userId}`, 5, 60000)) {
      throw new Error('Too many delete attempts. Please wait.');
    }

    // Verify user has permission to delete this settlement
    const { data: userSettlements, error: checkError } = await supabase
      .from('settlements')
      .select('user_id')
      .eq('transaction_group_id', transactionGroupId)
      .eq('user_id', userId)
      .limit(1);

    if (checkError) {
      throw checkError;
    }

    if (!userSettlements || userSettlements.length === 0) {
      throw new Error('Settlement not found or unauthorized');
    }

    const { error } = await supabase
      .from('settlements')
      .delete()
      .eq('transaction_group_id', transactionGroupId);

    if (error) {
      console.error(`[secureSettlementService] Error deleting settlement:`, error);
      throw error;
    }
  },
};
