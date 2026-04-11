import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Zap, Phone, MapPin, Clock, AlertTriangle, 
  Navigation, Search, CheckCircle, Star 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { useSeoPageContent } from '@/hooks/useSeoPageContent';
import { format } from 'date-fns';

export default function EmergencyDentistFinder() {
  const { data: seoContent } = useSeoPageContent("emergency-dentist");
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [currentTime] = useState(new Date());

  const currentDay = currentTime.getDay();
  const currentHour = currentTime.getHours();
  const isWeekend = currentDay === 0 || currentDay === 6;
  const isAfterHours = currentHour < 8 || currentHour >= 18;

  // Fetch states
  const { data: states } = useQuery({
    queryKey: ['emergency-states'],
    queryFn: async () => {
      const { data } = await supabase.from('states').select('id, name, abbreviation').eq('is_active', true).order('name');
      return data || [];
    },
  });

  // Fetch cities
  const { data: cities } = useQuery({
    queryKey: ['emergency-cities', stateId],
    queryFn: async () => {
      let q = supabase.from('cities').select('id, name, slug').eq('is_active', true).order('name');
      if (stateId) q = q.eq('state_id', stateId);
      const { data } = await q.limit(200);
      return data || [];
    },
  });

  // Search clinics
  const { data: clinics, isLoading } = useQuery({
    queryKey: ['emergency-clinics', stateId, cityId],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          id, name, slug, address, phone, rating, review_count, city_id,
          cities(name, states(abbreviation)),
          clinic_hours(day_of_week, open_time, close_time, is_closed)
        `)
        .eq('is_active', true)
        .not('phone', 'is', null);

      if (cityId) {
        query = query.eq('city_id', cityId);
      } else if (stateId) {
        query = query.eq('cities.state_id', stateId);
      }

      const { data } = await query.limit(30);

      return (data || []).map((clinic: any) => {
        const todayHours = clinic.clinic_hours?.find((h: any) => h.day_of_week === currentDay);
        let isOpenNow = false;

        if (todayHours && !todayHours.is_closed && todayHours.open_time && todayHours.close_time) {
          const openHour = parseInt(todayHours.open_time.split(':')[0]);
          const closeHour = parseInt(todayHours.close_time.split(':')[0]);
          isOpenNow = currentHour >= openHour && currentHour < closeHour;
        }

        const hasEmergencyHours = clinic.clinic_hours?.some((h: any) => {
          if (h.is_closed) return false;
          const closeHour = parseInt((h.close_time || '17:00').split(':')[0]);
          return closeHour >= 20;
        });

        return {
          ...clinic,
          cityName: clinic.cities?.name || '',
          stateAbbr: clinic.cities?.states?.abbreviation || '',
          is_open_now: isOpenNow,
          emergency_hours: hasEmergencyHours ? 'Extended hours available' : undefined,
        };
      }).sort((a: any, b: any) => {
        if (a.is_open_now && !b.is_open_now) return -1;
        if (!a.is_open_now && b.is_open_now) return 1;
        return (b.rating || 0) - (a.rating || 0);
      });
    },
    enabled: searchTriggered,
  });

  const openClinics = clinics?.filter((c: any) => c.is_open_now) || [];
  const closedClinics = clinics?.filter((c: any) => !c.is_open_now) || [];

  const filteredCities = citySearch
    ? cities?.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
    : cities;

  const handleSearch = () => {
    setSearchTriggered(true);
  };

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "Emergency Dentist Near Me | 24/7 Dental Care | AppointPanda"}
        description={seoContent?.meta_description || "Find emergency dentists open now near you. Get immediate dental care for toothaches, broken teeth, and dental emergencies."}
        canonical="/emergency-dentist/"
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <Zap className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Emergency Dentist Finder</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find dentists open now for urgent dental care. Select your state and city to see available offices.
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <Badge variant="outline" className="text-sm">
              <Clock className="h-3 w-3 mr-1" />
              {format(currentTime, 'EEEE, h:mm a')}
            </Badge>
            {(isWeekend || isAfterHours) && (
              <Badge className="bg-amber-500/20 text-amber-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {isWeekend ? 'Weekend Hours' : 'After Hours'}
              </Badge>
            )}
          </div>
        </div>

        {/* Search */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={stateId} onValueChange={(v) => { setStateId(v); setCityId(''); setSearchTriggered(false); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Select value={cityId} onValueChange={(v) => { setCityId(v); setSearchTriggered(false); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 pb-2">
                      <Input placeholder="Search cities..." value={citySearch} onChange={e => setCitySearch(e.target.value)} className="h-8" />
                    </div>
                    {filteredCities?.slice(0, 50).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="invisible">Search</Label>
                <Button className="w-full h-11" onClick={handleSearch} disabled={!stateId}>
                  <Search className="h-5 w-5 mr-2" />
                  Find Emergency Dentists
                </Button>
              </div>
            </div>
            {/* Quick action: search on state change */}
            {stateId && !searchTriggered && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">State selected — click the button above or:</p>
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  Search Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {searchTriggered && (
          <div className="space-y-8">
            {openClinics.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Open Now ({openClinics.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {openClinics.map((clinic: any) => (
                    <ClinicCard key={clinic.id} clinic={clinic} isOpen />
                  ))}
                </div>
              </div>
            )}

            {closedClinics.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Available Tomorrow ({closedClinics.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {closedClinics.slice(0, 8).map((clinic: any) => (
                    <ClinicCard key={clinic.id} clinic={clinic} isOpen={false} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && clinics?.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No clinics found in this area</h3>
                  <p className="text-muted-foreground mb-4">Try a nearby city or broader state search.</p>
                  <Button variant="outline" asChild>
                    <Link to="/search">Browse All Dentists</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Emergency Info */}
        <Card className="mt-8 border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              What Constitutes a Dental Emergency?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Seek Immediate Care For:</h3>
                <ul className="space-y-2 text-sm">
                  {['Severe toothache or dental pain', 'Knocked-out tooth (keep it moist!)', 'Broken or cracked tooth', 'Dental abscess or swelling', 'Uncontrolled bleeding after extraction'].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">What to Do While Waiting:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Rinse with warm salt water</li>
                  <li>• Apply cold compress to reduce swelling</li>
                  <li>• Take over-the-counter pain relievers</li>
                  <li>• Keep knocked-out tooth in milk</li>
                  <li>• Don't apply aspirin directly to gums</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Emergency Dental Care FAQs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">How much does an emergency dental visit cost?</h3>
              <p className="text-muted-foreground">
                Emergency visits typically cost $150-$300 for exam and X-rays. Use our Cost Calculator for specific procedure estimates.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Should I go to the ER for a dental emergency?</h3>
              <p className="text-muted-foreground">
                ERs can help with pain and antibiotics but usually can't perform dental procedures. An emergency dentist is the better choice.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function ClinicCard({ clinic, isOpen }: { clinic: any; isOpen: boolean }) {
  return (
    <Card className={isOpen ? 'border-green-500/30' : ''}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold">{clinic.name}</h3>
            <p className="text-sm text-muted-foreground">{clinic.address}</p>
            <p className="text-sm text-muted-foreground">{clinic.cityName}, {clinic.stateAbbr}</p>
          </div>
          {isOpen ? (
            <Badge className="bg-green-500/20 text-green-600">Open Now</Badge>
          ) : (
            <Badge variant="outline">Closed</Badge>
          )}
        </div>

        {clinic.rating && (
          <div className="flex items-center gap-1 mb-3">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-medium">{clinic.rating.toFixed(1)}</span>
            {clinic.review_count && (
              <span className="text-sm text-muted-foreground">({clinic.review_count} reviews)</span>
            )}
          </div>
        )}

        {clinic.emergency_hours && (
          <Badge variant="outline" className="mb-3 text-xs">{clinic.emergency_hours}</Badge>
        )}

        <div className="flex gap-2 mt-4">
          {clinic.phone && (
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${clinic.phone}`}>
                <Phone className="h-4 w-4 mr-1" /> Call
              </a>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to={`/clinic/${clinic.slug || clinic.id}`}>
              <Navigation className="h-4 w-4 mr-1" /> View Profile
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
