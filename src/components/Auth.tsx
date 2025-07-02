import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [signUpForm, setSignUpForm] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  const [signInForm, setSignInForm] = useState({
    email: '',
    password: ''
  });

  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      console.log('User is logged in, redirecting to dashboard');
      navigate("/");
    }
  }, [user, navigate]);

  const ensureUserProfile = async (userId: string, email: string, fullName?: string) => {
    try {
      console.log('🔍 Ensuring user profile exists for:', email);
      
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, name, full_name')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking existing profile:', fetchError);
        throw fetchError;
      }

      if (!existingProfile) {
        console.log('📝 Creating new user profile...');
        // Create profile if it doesn't exist
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: email.toLowerCase().trim(),
            full_name: fullName || null,
            name: fullName || email.split('@')[0], // Use name from email if no full name provided
            language: 'en'
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
          throw profileError;
        }

        console.log('✅ User profile created successfully');
      } else {
        console.log('✅ User profile already exists');
        
        // Update profile if missing information
        const updateData: any = {};
        if (!existingProfile.email) {
          updateData.email = email.toLowerCase().trim();
        }
        if (fullName && !existingProfile.full_name) {
          updateData.full_name = fullName;
        }
        if (!existingProfile.name) {
          updateData.name = fullName || email.split('@')[0];
        }

        if (Object.keys(updateData).length > 0) {
          console.log('📝 Updating user profile with missing data...');
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

          if (updateError) {
            console.error('Error updating user profile:', updateError);
            // Don't throw here as the profile exists, just log the warning
            console.warn('⚠️ Could not update profile with missing data');
          } else {
            console.log('✅ User profile updated successfully');
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring user profile:', error);
      throw error;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      console.log('🚀 Starting sign up process...');
      const { data, error } = await supabase.auth.signUp({
        email: signUpForm.email,
        password: signUpForm.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: signUpForm.fullName
          }
        }
      });

      if (error) {
        console.error('❌ Sign up error:', error);
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('📧 Sign up response:', data);
        
        // If user is immediately available (email confirmation disabled), create profile
        if (data.user && !data.user.email_confirmed_at) {
          console.log('📧 Email confirmation required');
          toast({
            title: "Sign Up Successful!",
            description: "Please check your email to confirm your account.",
          });
        } else if (data.user) {
          console.log('✅ User signed up and confirmed immediately');
          // User signed up successfully and is logged in
          await ensureUserProfile(data.user.id, data.user.email!, signUpForm.fullName);
          toast({
            title: "Welcome to AirMates!",
            description: "Your account has been created successfully.",
          });
        }
        setSignUpForm({ email: '', password: '', fullName: '' });
      }
    } catch (error: any) {
      console.error('💥 Critical sign up error:', error);
      toast({
        title: "Sign Up Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('🚀 Starting sign in process...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInForm.email,
        password: signInForm.password,
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (data.user) {
        console.log('✅ User signed in successfully');
        // Ensure user profile exists after successful login
        await ensureUserProfile(data.user.id, data.user.email!);
        
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        // Navigation will happen automatically via useEffect when user state changes
      }
    } catch (error: any) {
      console.error('💥 Critical sign in error:', error);
      toast({
        title: "Sign In Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            AirMates
          </CardTitle>
          <CardDescription>
            Your smart roommate expense manager
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={signInForm.email}
                      onChange={(e) => setSignInForm({...signInForm, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      value={signInForm.password}
                      onChange={(e) => setSignInForm({...signInForm, password: e.target.value})}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                  disabled={loading}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Enter your full name"
                      className="pl-10"
                      value={signUpForm.fullName}
                      onChange={(e) => setSignUpForm({...signUpForm, fullName: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      className="pl-10"
                      value={signUpForm.email}
                      onChange={(e) => setSignUpForm({...signUpForm, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a password"
                      className="pl-10 pr-10"
                      value={signUpForm.password}
                      onChange={(e) => setSignUpForm({...signUpForm, password: e.target.value})}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 w-8 p-0"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
