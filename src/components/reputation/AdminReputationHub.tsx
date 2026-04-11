import ReputationHub from './ReputationHub';

/**
 * Wrapper component for the ReputationHub in SuperAdmin context.
 * Shows platform-wide reputation data across all clinics.
 */
export default function AdminReputationHub() {
  // No clinicId = all clinics (admin view)
  return <ReputationHub isAdmin={true} />;
}
