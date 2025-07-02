
import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().email('Invalid email address').max(255);
export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name too long');
export const amountSchema = z.number().positive('Amount must be positive').max(1000000, 'Amount too large');
export const upiIdSchema = z.string().min(3, 'UPI ID too short').max(50, 'UPI ID too long').regex(/^[\w.\-@]+$/, 'Invalid UPI ID format');
export const phoneSchema = z.string().optional().refine((val) => !val || /^\+?[\d\s\-()]{10,15}$/.test(val), 'Invalid phone number');

// Form validation schemas
export const roommateSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  upi_id: upiIdSchema,
  phone: phoneSchema,
});

export const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  amount: amountSchema,
  category: z.string().min(1, 'Category is required').max(50, 'Category too long'),
  paid_by: nameSchema,
  sharers: z.array(emailSchema).min(1, 'At least one sharer required').max(20, 'Too many sharers'),
});

export const settlementSchema = z.object({
  amount: amountSchema,
  name: nameSchema,
  email: emailSchema,
  upi_id: upiIdSchema,
  type: z.enum(['owes', 'owed']),
});

// Input sanitization
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
  return sanitizeHtml(input.trim().slice(0, maxLength));
};

// Rate limiting helper
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (key: string, maxRequests: number = 10, windowMs: number = 60000): boolean => {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= maxRequests) {
    return false;
  }
  
  entry.count++;
  return true;
};
