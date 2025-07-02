
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface Roommate {
  id: string;
  name: string;
  upi_id: string;
  email: string;
  phone?: string;
  balance: number;
  user_id: string;
}

export const useRoommates = () => {
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchRoommates = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Fetching roommates for user:', user.email);
      
      const { data, error } = await supabase
        .from('roommates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase error fetching roommates:', error);
        throw error;
      }
      
      console.log('✅ Fetched roommates:', data);
      setRoommates(data || []);
    } catch (error: any) {
      console.error('💥 Error fetching roommates:', error);
      toast({
        title: "Error",
        description: `Failed to fetch roommates: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRoommate = async (email: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add roommates",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🚀 DEBUGGING ROOMMATE ADDITION');
      console.log('📧 Target email:', email);
      console.log('👤 Current user:', user.id, user.email);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }

      // Check if trying to add themselves
      if (email.toLowerCase() === user.email?.toLowerCase()) {
        toast({
          title: "Error",
          description: "You cannot add yourself as a roommate",
          variant: "destructive",
        });
        return;
      }

      console.log('🔍 STEP 1: Checking auth.users table directly');
      
      // First, let's check auth.users directly using a database function
      const { data: authUsers, error: authError } = await supabase.rpc('get_users_details', {
        p_user_ids: []
      });
      
      console.log('📊 Auth users check result:', { authUsers, authError });

      // Check profiles table
      console.log('🔍 STEP 2: Checking profiles table');
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('*');
      
      console.log('📊 All profiles in system:', allProfiles);
      console.log('📊 Profiles error:', allProfilesError);

      // Look for target user profile
      const { data: targetUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, name, full_name, upi_id, mobile_number')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      console.log('📊 Target user profile query:', { targetUserProfile, profileError });

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Database error:', profileError);
        toast({
          title: "Database Error",
          description: "Failed to verify user. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (!targetUserProfile) {
        console.log('❌ USER NOT FOUND IN PROFILES');
        
        // Let's try a different approach - search by partial email match
        const { data: partialMatch, error: partialError } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', `%${email}%`);
        
        console.log('🔍 Partial email match results:', partialMatch);
        
        toast({
          title: "❌ User Not Found",
          description: `No user found with email "${email}". Make sure they have signed up and logged in at least once.`,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ FOUND USER! Profile:', targetUserProfile);

      // Check for duplicates
      const { data: existingRoommate, error: checkError } = await supabase
        .from('roommates')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking existing roommate:', checkError);
        throw checkError;
      }

      if (existingRoommate) {
        console.log('⚠️ Duplicate found');
        toast({
          title: "Already Added",
          description: "This roommate has already been added to your list.",
          variant: "destructive",
        });
        return;
      }

      console.log('🚀 CREATING ROOMMATE ENTRIES');

      // Get current user's profile
      const { data: currentUserProfile, error: currentProfileError } = await supabase
        .from('profiles')
        .select('id, email, name, full_name, upi_id, mobile_number')
        .eq('id', user.id)
        .single();

      console.log('📊 Current user profile:', currentUserProfile);

      // Create roommate entry for current user
      const roommateData = { 
        name: targetUserProfile.name || targetUserProfile.full_name || targetUserProfile.email.split('@')[0] || 'Unknown',
        upi_id: targetUserProfile.upi_id || 'Not set',
        email: targetUserProfile.email,
        phone: targetUserProfile.mobile_number || null,
        user_id: user.id,
        balance: 0 
      };

      console.log('📝 Creating roommate with data:', roommateData);

      const { error: currentUserRoommateError } = await supabase
        .from('roommates')
        .insert([roommateData]);

      if (currentUserRoommateError) {
        console.error('❌ Failed to create roommate:', currentUserRoommateError);
        throw currentUserRoommateError;
      }

      console.log('✅ Roommate created successfully!');

      // Create reciprocal entry for target user
      if (currentUserProfile) {
        const reciprocalData = { 
          name: currentUserProfile.name || currentUserProfile.full_name || user.email?.split('@')[0] || 'Unknown User',
          upi_id: currentUserProfile.upi_id || 'Not set',
          email: user.email || '',
          phone: currentUserProfile.mobile_number || null,
          user_id: targetUserProfile.id,
          balance: 0 
        };

        console.log('📝 Creating reciprocal roommate with data:', reciprocalData);

        const { error: targetUserRoommateError } = await supabase
          .from('roommates')
          .insert([reciprocalData]);

        if (targetUserRoommateError) {
          console.error('❌ Failed to create reciprocal roommate entry:', targetUserRoommateError);
        } else {
          console.log('✅ Reciprocal roommate created successfully!');
        }
      }

      await fetchRoommates();
      
      toast({
        title: "🎉 Success!",
        description: `Roommate added successfully!`,
      });
      
    } catch (error: any) {
      console.error('💥 CRITICAL ERROR in addRoommate:', error);
      toast({
        title: "Addition Failed",
        description: `Could not add roommate: ${error.message || 'Unknown error occurred'}`,
        variant: "destructive",
      });
    }
  };

  const deleteRoommate = async (roommateId: string) => {
    try {
      console.log('🗑️ Deleting roommate:', roommateId);
      
      const { error } = await supabase
        .from('roommates')
        .delete()
        .eq('id', roommateId);

      if (error) {
        console.error('❌ Supabase delete error:', error);
        throw error;
      }
      
      await fetchRoommates();
      
      toast({
        title: "Roommate Removed",
        description: "Roommate has been removed from your group",
      });
    } catch (error: any) {
      console.error('💥 Error deleting roommate:', error);
      toast({
        title: "Error",
        description: `Failed to delete roommate: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const deleteAllMyRoommates = async () => {
    if (!user) return;
    try {
      console.log('🗑️ Deleting all roommates for user:', user.id);
      const { error } = await supabase
        .from('roommates')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      await fetchRoommates();
      
      toast({
        title: "All Roommates Removed",
        description: "All roommates you added have been removed.",
      });
    } catch (error: any) {
      console.error('💥 Error deleting all roommates:', error);
      toast({
        title: "Error",
        description: `Failed to remove all roommates: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const sendEmailRequest = async (roommate: Roommate) => {
    try {
      const emailData = {
        to: [roommate.email],
        subject: "Payment Request from AirMates",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Payment Request</h2>
            <p>Hi ${roommate.name},</p>
            <p>You have a pending payment request on AirMates.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin: 0; color: #374151; font-size: 24px;">Amount Due: ₹${Math.abs(roommate.balance)}</h3>
            </div>
            <p>Please settle this amount at your earliest convenience.</p>
          </div>
        `,
        from: "AirMates <AirMates@airmedisphere.in>"
      };

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: emailData
      });

      if (error) throw error;

      toast({
        title: "Request Sent!",
        description: `Payment request email sent to ${roommate.name}`,
      });
    } catch (error: any) {
      console.error('💥 Error sending email:', error);
      toast({
        title: "Failed to Send Request",
        description: `Failed to send email to ${roommate.name}`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchRoommates();
    } else {
      setRoommates([]);
      setLoading(false);
    }
  }, [user]);

  return {
    roommates,
    loading,
    addRoommate,
    deleteRoommate,
    deleteAllMyRoommates,
    sendEmailRequest,
    refetch: fetchRoommates
  };
};
