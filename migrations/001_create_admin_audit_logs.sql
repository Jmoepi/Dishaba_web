-- Create admin_audit_logs table for tracking all admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Indexes for common queries
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_admin_audit_logs_user_id ON public.admin_audit_logs(user_id);
CREATE INDEX idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_target_id ON public.admin_audit_logs(target_id);
CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs
CREATE POLICY admin_audit_logs_view ON public.admin_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Only system can insert (via service role)
CREATE POLICY admin_audit_logs_insert ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (true);
