import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ZocdocBookingForm } from "@/components/booking/ZocdocBookingForm";

interface MultiStepBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
  profileType: "dentist" | "clinic";
  clinicId?: string;
  clinicLatitude?: number;
  clinicLongitude?: number;
  clinicAddress?: string;
}

export function MultiStepBookingModal({
  open,
  onOpenChange,
  profileId,
  profileName,
  profileType,
  clinicId,
  clinicLatitude,
  clinicLongitude,
  clinicAddress,
}: MultiStepBookingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-0 bg-card p-0 overflow-hidden max-h-[90vh] max-w-[calc(100vw-2rem)]">
        <ZocdocBookingForm
          profileId={profileId}
          profileName={profileName}
          profileType={profileType}
          clinicId={clinicId}
          clinicLatitude={clinicLatitude}
          clinicLongitude={clinicLongitude}
          clinicAddress={clinicAddress}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
