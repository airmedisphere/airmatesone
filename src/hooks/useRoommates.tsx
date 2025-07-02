
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
      console.log('🚀 STARTING ROOMMATE ADDITION');
      console.log('📧 Adding roommate with email:', email);
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

      console.log('🔍 STEP 1: Checking if user exists in auth.users');
      
      // First, check if user exists in auth.users by trying to find their profile
      const { data: targetUserProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, name, full_name, upi_id, mobile_number')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      console.log('📊 Profile query result:', { targetUserProfile, profileError });

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
        console.log('❌ USER NOT FOUND');
        toast({
          title: "❌ User Not Found",
          description: `No AirMates account found for "${email}". The user must create an account and verify their email first.`,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ STEP 1 COMPLETE - User exists!');
      console.log('📧 Found user profile:', targetUserProfile);

      console.log('🔍 STEP 2: Checking for duplicates');
      
      // Check if roommate already exists
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

      console.log('✅ STEP 2 COMPLETE - No duplicates');
      console.log('🚀 STEP 3: Creating roommate entries');

      // Get current user's profile for bidirectional sync
      const { data: currentUserProfile, error: currentProfileError } = await supabase
        .from('profiles')
        .select('id, email, name, full_name, upi_id, mobile_number')
        .eq('id', user.id)
        .single();

      if (currentProfileError) {
        console.error('❌ Failed to get current user profile:', currentProfileError);
        // Continue anyway, we'll use basic info
      }

      // Create roommate entry for current user (adding target as roommate)
      const { error: currentUserRoommateError } = await supabase
        .from('roommates')
        .insert([{ 
          name: targetUserProfile.name || targetUserProfile.full_name || targetUserProfile.email.split('@')[0],
          upi_id: targetUserProfile.upi_id || 'Not set',
          email: targetUserProfile.email,
          phone: targetUserProfile.mobile_number || null,
          user_id: user.id,
          balance: 0 
        }]);

      if (currentUserRoommateError) {
        console.error('❌ Failed to create roommate for current user:', currentUserRoommateError);
        throw currentUserRoommateError;
      }

      console.log('✅ Step 3a: Created roommate entry for current user');

      // Create reciprocal roommate entry for target user (adding current user as roommate)
      const { error: targetUserRoommateError } = await supabase
        .from('roommates')
        .insert([{ 
          name: currentUserProfile?.name || currentUserProfile?.full_name || user.email?.split('@')[0] || 'Unknown User',
          upi_id: currentUserProfile?.upi_id || 'Not set',
          email: user.email || '',
          phone: currentUserProfile?.mobile_number || null,
          user_id: targetUserProfile.id,
          balance: 0 
        }]);

      if (targetUserRoommateError) {
        console.error('❌ Failed to create reciprocal roommate entry:', targetUserRoommateError);
        console.warn('⚠️ Roommate relationship is not fully bidirectional');
      } else {
        console.log('✅ Step 3b: Created reciprocal roommate entry');
      }

      console.log('🎉 SUCCESS! Roommate added successfully');
      
      // Refresh the roommates list
      await fetchRoommates(); 
      
      toast({
        title: "🎉 Success!",
        description: `Roommate has been added successfully! Both of you can now see each other in your roommate lists.`,
      });
      
    } catch (error: any) {
      console.error('💥 CRITICAL ERROR in addRoommate:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
      
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
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this action.",
        variant: "destructive",
      });
      return;
    }
    try {
      console.log('🗑️ Deleting all roommates for user:', user.id);
      const { error } = await supabase
        .from('roommates')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ Supabase delete all roommates error:', error);
        throw error;
      }
      
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
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0;">AirMates</h1>
              <p style="color: #6b7280; margin: 5px 0;">Your Smart Roommate Expense Manager</p>
            </div>
            
            <h2 style="color: #2563eb;">Payment Request</h2>
            <p>Hi ${roommate.name},</p>
            <p>You have a pending payment request on AirMates.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin: 0; color: #374151; font-size: 24px;">Amount Due: ₹${Math.abs(roommate.balance)}</h3>
              <p style="margin: 10px 0 0 0; color: #6b7280;">Please settle this amount at your earliest convenience.</p>
            </div>
            
            <p>You can make the payment using your UPI ID: <strong>${roommate.upi_id}</strong></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0;">Best regards,<br/>
              <strong>AirMates Team</strong><br/>
              <span style="color: #6b7280;">Managing roommate expenses made easy</span></p>
            </div>
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
