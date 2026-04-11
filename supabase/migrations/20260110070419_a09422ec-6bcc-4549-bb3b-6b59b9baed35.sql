-- Create a function to call the email notification edge function
CREATE OR REPLACE FUNCTION public.trigger_appointment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger for new bookings or status changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Use pg_notify to trigger async processing (edge function will be called by webhook)
    PERFORM pg_notify('appointment_email', json_build_object(
      'appointment_id', NEW.id,
      'type', CASE WHEN TG_OP = 'INSERT' THEN 'new_booking' ELSE 'status_update' END,
      'new_status', NEW.status,
      'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS appointment_email_trigger ON public.appointments;
CREATE TRIGGER appointment_email_trigger
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_appointment_email();