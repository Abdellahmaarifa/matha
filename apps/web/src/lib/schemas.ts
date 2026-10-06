import { z } from "zod";

// Mirrors the backend's manual validation in api/app/common/validation.py.
// Kept in sync by hand -- there is no shared codegen between Python and Zod,
// so any rule change on one side must be mirrored on the other.

export const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;
export const namePattern = /^[^\d]{1,60}$/;

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128, "That's too long")
  .refine((value) => {
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(value)).length;
    return classes >= 3;
  }, "Mix upper/lowercase, digits and symbols");

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email"),
  username: z.string().regex(usernamePattern, "3-20 letters, digits or underscore"),
  first_name: z.string().min(1, "Required").max(60).regex(namePattern, "No digits allowed"),
  last_name: z.string().min(1, "Required").max(60).regex(namePattern, "No digits allowed"),
  birth_date: z.string().refine((value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age <= 120;
  }, "You must be at least 18"),
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

const birthDateSchema = z.string().refine((value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age >= 18 && age <= 120;
}, "You must be at least 18");

// OAuth signups skip the password field (the provider handles authentication)
// but still need everything else a normal registration collects.
export const completeOAuthSignupSchema = z.object({
  token: z.string().min(1),
  username: z.string().regex(usernamePattern, "3-20 letters, digits or underscore"),
  first_name: z.string().min(1, "Required").max(60).regex(namePattern, "No digits allowed"),
  last_name: z.string().min(1, "Required").max(60).regex(namePattern, "No digits allowed"),
  birth_date: birthDateSchema,
  email: z.string().email("Enter a valid email").optional(),
});
export type CompleteOAuthSignupInput = z.infer<typeof completeOAuthSignupSchema>;

// Form-only schema (adds a confirm-password field that never reaches the API --
// registerSchema/RegisterInput above stay the exact API payload shape).
export const registerFormSchema = registerSchema
  .extend({ confirm_password: z.string().min(1, "Required") })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });
export type RegisterFormInput = z.infer<typeof registerFormSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const resetPasswordFormSchema = resetPasswordSchema
  .extend({ confirm_password: z.string().min(1, "Required") })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

export const GENDERS = ["man", "woman", "other"] as const;
export const ORIENTATIONS = ["heterosexual", "homosexual", "bisexual"] as const;

export const editProfileSchema = z.object({
  first_name: z.string().min(1).max(60).regex(namePattern, "No digits allowed"),
  last_name: z.string().min(1).max(60).regex(namePattern, "No digits allowed"),
  email: z.string().email("Enter a valid email"),
  gender: z.enum(GENDERS),
  sexual_pref: z.enum(ORIENTATIONS),
  biography: z.string().max(2000),
});
export type EditProfileInput = z.infer<typeof editProfileSchema>;

export const tagsSchema = z.object({
  tags: z.array(z.string().regex(/^[a-z0-9_]{1,30}$/i)).max(15),
});

export const messageSchema = z.object({
  body: z.string().min(1, "Say something").max(2000),
});
export type MessageInput = z.infer<typeof messageSchema>;

export const REPORT_REASONS = ["fake_account", "harassment", "inappropriate_content", "other"] as const;
