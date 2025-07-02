
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { roommateSchema, checkRateLimit, sanitizeInput } from '@/utils/validation';

interface Roommate {
  id: string;
  name: string;
  upi_id: string;
  email: string;
  phone?: string;
  balance: number;
  user_id: string;
}

export const useSecureRoommates = () => {
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
      console.log('Fetching roommates for user:', user.email);
      
      const { data, error } = await supabase
        .from('roommates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching roommates:', error);
        throw error;
      }
      
      console.log('Fetched roommates:', data);
      setRoommates(data || []);
    } catch (error: any) {
      console.error('Error fetching roommates:', error);
      toast({
        title: "Error",
        description: `Failed to fetch roommates: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addRoommate = async (roommate: Omit<Roommate, 'id' | 'user_id' | 'balance'>) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add roommates",
        variant: "destructive",
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(`roommate_add_${user.id}`, 5, 60000)) {
      toast({
        title: "Error",
        description: "Too many requests. Please wait before adding another roommate.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate and sanitize input
      const validatedData = roommateSchema.parse({
        name: sanitizeInput(roommate.name, 100),
        email: roommate.email.toLowerCase().trim(),
        upi_id: sanitizeInput(roommate.upi_id, 50),
        phone: roommate.phone ? sanitizeInput(roommate.phone, 20) : undefined,
      });

      console.log('Adding roommate with validated data:', validatedData);

      // Check if trying to add themselves
      if (validatedData.email === user.email) {
        toast({
          title: "Error",
          description: "You cannot add yourself as a roommate",
          variant: "destructive",
        });
        return;
      }

      // Verify user exists in the system
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, name')
        .eq('email', validatedData.email)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Database error:', profileError);
        toast({
          title: "Database Error",
          description: "Failed to verify user. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (!profileData) {
        toast({
          title: "User Not Found",
          description: `No account found for "${validatedData.email}". The user must create an account first.`,
          variant: "destructive",
        });
        return;
      }

      // Check for duplicates
      const { data: existingRoommate, error: checkError } = await supabase
        .from('roommates')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', validatedData.email)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing roommate:', checkError);
        throw checkError;
      }

      if (existingRoommate) {
        toast({
          title: "Already Added",
          description: "This roommate has already been added to your list.",
          variant: "destructive",
        });
        return;
      }

      // Insert new roommate
      const { data, error } = await supabase
        .from('roommates')
        .insert([{ 
          name: validatedData.name,
          upi_id: validatedData.upi_id,
          email: validatedData.email,
          phone: validatedData.phone || null,
          user_id: user.id,
          balance: 0 
        }])
        .select()
        .single();

      if (error) {
        console.error('Database insert failed:', error);
        throw error;
      }

      await fetchRoommates();
      
      toast({
        title: "Success!",
        description: `${validatedData.name} has been added to your roommate group!`,
      });
      
    } catch (error: any) {
      console.error('Error in addRoommate:', error);
      
      if (error.name === 'ZodError') {
        toast({
          title: "Invalid Input",
          description: error.errors[0]?.message || "Please check your input and try again",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Addition Failed",
          description: `Could not add roommate: ${error.message || 'Unknown error occurred'}`,
          variant: "destructive",
        });
      }
    }
  };

  const deleteRoommate = async (roommateId: string) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Authentication required",
        variant: "destructive",
      });
      return;
    }

    // Rate limiting
    if (!checkRateLimit(`roommate_delete_${user.id}`, 10, 60000)) {
      toast({
        title: "Error",
        description: "Too many requests. Please wait.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Deleting roommate:', roommateId);
      
      const { error } = await supabase
        .from('roommates')
        .delete()
        .eq('id', roommateId)
        .eq('user_id', user.id); // Ensure user can only delete their own roommates

      if (error) {
        console.error('Supabase delete error:', error);
        throw error;
      }
      
      await fetchRoommates();
      
      toast({
        title: "Roommate Removed",
        description: "Roommate has been removed from your group",
      });
    } catch (error: any) {
      console.error('Error deleting roommate:', error);
      toast({
        title: "Error",
        description: `Failed to delete roommate: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const sendEmailRequest = async (roommate: Roommate) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Authentication required",
        variant: "destructive",
      });
      return;
    }

    // Rate limiting for email requests
    if (!checkRateLimit(`email_${user.id}`, 3, 300000)) { // 3 emails per 5 minutes
      toast({
        title: "Rate Limited",
        description: "Please wait before sending another email request.",
        variant: "destructive",
      });
      return;
    }

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
            <p>Hi ${sanitizeInput(roommate.name)},</p>
            <p>You have a pending payment request on AirMates.</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3 style="margin: 0; color: #374151; font-size: 24px;">Amount Due: ₹${Math.abs(roommate.balance)}</h3>
              <p style="margin: 10px 0 0 0; color: #6b7280;">Please settle this amount at your earliest convenience.</p>
            </div>
            
            <p>You can make the payment using UPI ID: <strong>${sanitizeInput(roommate.upi_id)}</strong></p>
            
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
      console.error('Error sending email:', error);
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
    sendEmailRequest,
    refetch: fetchRoommates
  };
};
