/**
 * Advanced Features Panel - Sprint 4.2
 * 
 * Tracks development progress for:
 * - Advanced Search Filters
 * - Enhanced Review System
 * - Virtual Consultation Integration
 * - Cost Estimator Enhancements
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Filter, 
  Star, 
  Video, 
  Calculator,
  CheckCircle2,
  Clock,
  Zap,
  Settings,
  Users,
  Calendar,
  MessageSquare,
  Shield,
  Globe,
  Baby,
  Accessibility,
  Moon,
  Sun
} from 'lucide-react';

interface FeatureStatus {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in-progress' | 'planned';
  progress: number;
  subFeatures?: { name: string; completed: boolean }[];
}

export default function AdvancedFeaturesPanel() {
  const [enabledFilters, setEnabledFilters] = useState<Record<string, boolean>>({
    availableToday: true,
    weekendHours: true,
    eveningHours: true,
    acceptsNewPatients: true,
    languagesSpoken: true,
    wheelchairAccessible: true,
    pediatricFriendly: true,
    sedationOptions: true,
    patientRatings: true,
    yearsInPractice: true,
    genderPreference: true,
    verifiedReviews: true
  });

  const features: FeatureStatus[] = [
    {
      id: 'search-filters',
      name: 'Advanced Search Filters',
      description: 'Enhanced filtering options for better dentist discovery',
      status: 'completed',
      progress: 100,
      subFeatures: [
        { name: 'Availability filters (today/week)', completed: true },
        { name: 'Weekend hours filter', completed: true },
        { name: 'Evening hours filter', completed: true },
        { name: 'Languages spoken filter', completed: true },
        { name: 'Wheelchair accessible filter', completed: true },
        { name: 'Pediatric-friendly filter', completed: true },
        { name: 'Sedation options filter', completed: true },
        { name: 'Patient ratings (4+ stars)', completed: true },
        { name: 'Years in practice filter', completed: true },
        { name: 'Accepts new patients toggle', completed: true }
      ]
    },
    {
      id: 'review-system',
      name: 'Enhanced Review System',
      description: 'Verified reviews with detailed categories and dentist responses',
      status: 'in-progress',
      progress: 65,
      subFeatures: [
        { name: 'Verified patient reviews', completed: true },
        { name: 'Photo uploads (office, waiting room)', completed: false },
        { name: 'Dentist response capability', completed: true },
        { name: 'Helpful/not helpful voting', completed: true },
        { name: 'Detailed rating categories', completed: false },
        { name: 'Bedside manner rating', completed: false },
        { name: 'Wait time rating', completed: false },
        { name: 'Office cleanliness rating', completed: false }
      ]
    },
    {
      id: 'cost-estimator',
      name: 'Enhanced Cost Estimator',
      description: 'Insurance-aware cost estimation with dentist comparison',
      status: 'completed',
      progress: 100,
      subFeatures: [
        { name: 'Insurance input integration', completed: true },
        { name: 'Procedure cost breakdown', completed: true },
        { name: 'Out-of-pocket estimates', completed: true },
        { name: 'Compare dentists by price', completed: true },
        { name: 'Schedule consultation CTA', completed: true }
      ]
    },
    {
      id: 'virtual-consult',
      name: 'Virtual Consultation',
      description: 'Video consultation capability with document sharing',
      status: 'planned',
      progress: 15,
      subFeatures: [
        { name: 'Video chat capability', completed: false },
        { name: 'Pre-consultation forms', completed: true },
        { name: 'Document upload (X-rays, insurance)', completed: false },
        { name: 'Payment processing', completed: false },
        { name: 'Follow-up scheduling', completed: false },
        { name: 'HIPAA compliance', completed: false }
      ]
    }
  ];

  const filterGroups = [
    {
      name: 'Availability Filters',
      icon: Calendar,
      filters: [
        { id: 'availableToday', label: 'Available Today', icon: Clock },
        { id: 'weekendHours', label: 'Weekend Hours', icon: Calendar },
        { id: 'eveningHours', label: 'Evening Hours', icon: Moon },
        { id: 'acceptsNewPatients', label: 'Accepts New Patients', icon: Users }
      ]
    },
    {
      name: 'Accessibility Filters',
      icon: Accessibility,
      filters: [
        { id: 'languagesSpoken', label: 'Languages Spoken', icon: Globe },
        { id: 'wheelchairAccessible', label: 'Wheelchair Accessible', icon: Accessibility },
        { id: 'pediatricFriendly', label: 'Pediatric Friendly', icon: Baby },
        { id: 'sedationOptions', label: 'Sedation Options', icon: Shield }
      ]
    },
    {
      name: 'Quality Filters',
      icon: Star,
      filters: [
        { id: 'patientRatings', label: 'Patient Ratings (4+ Stars)', icon: Star },
        { id: 'yearsInPractice', label: 'Years in Practice', icon: Clock },
        { id: 'genderPreference', label: 'Gender Preference', icon: Users },
        { id: 'verifiedReviews', label: 'Verified Reviews Only', icon: CheckCircle2 }
      ]
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'in-progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'planned':
        return <Badge variant="outline">Planned</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Feature Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {features.map((feature) => (
          <Card key={feature.id} className={
            feature.status === 'completed' ? 'border-green-500/50' :
            feature.status === 'in-progress' ? 'border-blue-500/50' : ''
          }>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-2">
                {feature.id === 'search-filters' && <Filter className="h-5 w-5 text-primary" />}
                {feature.id === 'review-system' && <Star className="h-5 w-5 text-primary" />}
                {feature.id === 'cost-estimator' && <Calculator className="h-5 w-5 text-primary" />}
                {feature.id === 'virtual-consult' && <Video className="h-5 w-5 text-primary" />}
                {getStatusBadge(feature.status)}
              </div>
              <h4 className="font-medium text-sm mb-1">{feature.name}</h4>
              <Progress value={feature.progress} className="h-1 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{feature.progress}% complete</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Advanced Search Filters Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Search Filters
          </CardTitle>
          <CardDescription>
            Configure which filters are available to users on search pages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filterGroups.map((group) => (
              <div key={group.name} className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <group.icon className="h-4 w-4" />
                  {group.name}
                </div>
                <div className="space-y-3">
                  {group.filters.map((filter) => (
                    <div key={filter.id} className="flex items-center justify-between">
                      <Label htmlFor={filter.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <filter.icon className="h-4 w-4 text-muted-foreground" />
                        {filter.label}
                      </Label>
                      <Switch
                        id={filter.id}
                        checked={enabledFilters[filter.id]}
                        onCheckedChange={(checked) => 
                          setEnabledFilters(prev => ({ ...prev, [filter.id]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-6" />
          <div className="flex justify-end">
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Save Filter Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Development Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => (
          <Card key={feature.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{feature.name}</CardTitle>
                {getStatusBadge(feature.status)}
              </div>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {feature.subFeatures?.map((sub, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-2 text-sm p-2 rounded ${
                      sub.completed 
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' 
                        : 'bg-muted'
                    }`}
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    {sub.name}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>{feature.progress}%</span>
                </div>
                <Progress value={feature.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
