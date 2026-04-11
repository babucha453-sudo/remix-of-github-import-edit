import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Shield, Plus } from 'lucide-react';
import { AddPracticeModal } from './AddPracticeModal';

interface NoPracticeLinkedProps {
  compact?: boolean;
}

export function NoPracticeLinked({ compact = false }: NoPracticeLinkedProps) {
  const [showAddPracticeModal, setShowAddPracticeModal] = useState(false);

  if (compact) {
    return (
      <>
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Practice Linked</h2>
          <p className="text-muted-foreground mb-6">
            Please claim or add your practice profile first.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link to="/claim-profile">
                <Shield className="h-4 w-4 mr-2" />
                Claim Profile
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setShowAddPracticeModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Practice
            </Button>
          </div>
        </div>

        <AddPracticeModal 
          open={showAddPracticeModal} 
          onOpenChange={setShowAddPracticeModal} 
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-teal/20 flex items-center justify-center mb-8 animate-bounce-gentle">
          <Building2 className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-3xl font-extrabold mb-3">No Practice Linked</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          Your account is not linked to any clinic yet. You can claim an existing profile or add your practice to the directory.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg" className="rounded-2xl px-8 bg-gradient-to-r from-primary to-teal hover:from-primary/90 hover:to-teal/90">
            <Link to="/claim-profile">
              <Shield className="h-5 w-5 mr-2" />
              Claim Existing Profile
            </Link>
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="rounded-2xl px-8"
            onClick={() => setShowAddPracticeModal(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Your Practice
          </Button>
        </div>
      </div>
      
      <AddPracticeModal 
        open={showAddPracticeModal} 
        onOpenChange={setShowAddPracticeModal} 
      />
    </>
  );
}
