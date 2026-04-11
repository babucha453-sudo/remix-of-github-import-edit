import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, DollarSign, Search, TrendingUp, ArrowRight, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { useSeoPageContent } from '@/hooks/useSeoPageContent';

export default function DentalCostCalculator() {
  const { data: seoContent } = useSeoPageContent("tools/dental-cost-calculator");
  const [treatmentId, setTreatmentId] = useState('');
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const [hasInsurance, setHasInsurance] = useState<boolean | null>(null);
  const [insuranceCoverage, setInsuranceCoverage] = useState(50);
  const [citySearch, setCitySearch] = useState('');

  // Fetch treatments
  const { data: treatments } = useQuery({
    queryKey: ['tool-treatments'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch states
  const { data: states } = useQuery({
    queryKey: ['tool-states'],
    queryFn: async () => {
      const { data } = await supabase
        .from('states')
        .select('id, name, abbreviation')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Fetch cities filtered by state
  const { data: cities } = useQuery({
    queryKey: ['tool-cities', stateId],
    queryFn: async () => {
      let q = supabase
        .from('cities')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      if (stateId) q = q.eq('state_id', stateId);
      const { data } = await q.limit(200);
      return data || [];
    },
  });

  // Fetch real pricing data for selected treatment
  const { data: pricingData } = useQuery({
    queryKey: ['tool-pricing', treatmentId, stateId, cityId],
    queryFn: async () => {
      if (!treatmentId) return null;

      let query = supabase
        .from('clinic_treatments')
        .select('price_from, price_to, clinic_id, clinics!inner(id, name, slug, rating, review_count, city_id, is_active, cities!inner(name, state_id, states!inner(abbreviation)))')
        .eq('treatment_id', treatmentId)
        .eq('clinics.is_active', true)
        .not('price_from', 'is', null);

      if (cityId) {
        query = query.eq('clinics.city_id', cityId);
      } else if (stateId) {
        query = query.eq('clinics.cities.state_id', stateId);
      }

      const { data } = await query.limit(100);

      if (!data || data.length === 0) return null;

      const prices = data.map((d: any) => ({
        from: d.price_from,
        to: d.price_to || d.price_from,
        clinic: d.clinics,
      }));

      const allFrom = prices.map(p => p.from);
      const allTo = prices.map(p => p.to);
      const minPrice = Math.min(...allFrom);
      const maxPrice = Math.max(...allTo);
      const avgPrice = Math.round(allFrom.reduce((a: number, b: number) => a + b, 0) / allFrom.length);

      // Top clinics by rating
      const topClinics = prices
        .filter((p: any) => p.clinic?.rating)
        .sort((a: any, b: any) => (b.clinic.rating || 0) - (a.clinic.rating || 0))
        .slice(0, 5);

      return { minPrice, maxPrice, avgPrice, count: data.length, topClinics };
    },
    enabled: !!treatmentId,
  });

  // Budget ranges for the selected treatment
  const { data: budgetRanges } = useQuery({
    queryKey: ['tool-budget-ranges', treatmentId],
    queryFn: async () => {
      if (!treatmentId) return [];
      const { data } = await supabase
        .from('budget_ranges')
        .select('id, label, price_min, price_max')
        .eq('treatment_id', treatmentId)
        .eq('is_active', true)
        .order('price_min');
      return data || [];
    },
    enabled: !!treatmentId,
  });

  // Calculate insurance-adjusted costs
  const costEstimate = useMemo(() => {
    if (!pricingData) return null;

    const avg = pricingData.avgPrice;
    let outOfPocket = avg;
    let insurancePays = 0;

    if (hasInsurance && insuranceCoverage > 0) {
      insurancePays = Math.round(avg * (insuranceCoverage / 100));
      outOfPocket = avg - insurancePays;
    }

    return { ...pricingData, outOfPocket, insurancePays };
  }, [pricingData, hasInsurance, insuranceCoverage]);

  const filteredCities = citySearch
    ? cities?.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
    : cities;

  const selectedTreatment = treatments?.find(t => t.id === treatmentId);
  const selectedState = states?.find(s => s.id === stateId);

  return (
    <PageLayout>
      <SEOHead
        title={seoContent?.meta_title || "Dental Cost Calculator | Real Dentist Prices | AppointPanda"}
        description={seoContent?.meta_description || "Get real cost estimates from verified dentists. Compare prices for dental implants, crowns, cleanings and more in your city."}
        canonical="/tools/dental-cost-calculator/"
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Dental Cost Calculator</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get real cost estimates from verified dentists on our platform. Prices are submitted directly by dental offices.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calculator Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Calculate Your Cost
              </CardTitle>
              <CardDescription>Select a treatment and location to see real prices from dentists</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Treatment */}
              <div className="space-y-2">
                <Label>Select Treatment</Label>
                <Select value={treatmentId} onValueChange={(v) => { setTreatmentId(v); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a dental treatment" />
                  </SelectTrigger>
                  <SelectContent>
                    {treatments?.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={stateId} onValueChange={(v) => { setStateId(v); setCityId(''); }}>
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
                  <Select value={cityId} onValueChange={setCityId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Search cities..."
                          value={citySearch}
                          onChange={e => setCitySearch(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      {filteredCities?.slice(0, 50).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Insurance */}
              <div className="space-y-4">
                <Label>Do you have dental insurance?</Label>
                <div className="flex gap-3">
                  <Button variant={hasInsurance === true ? 'default' : 'outline'} onClick={() => setHasInsurance(true)}>
                    Yes
                  </Button>
                  <Button variant={hasInsurance === false ? 'default' : 'outline'} onClick={() => setHasInsurance(false)}>
                    No
                  </Button>
                </div>
                {hasInsurance && (
                  <div className="space-y-2">
                    <Label>Estimated Coverage: {insuranceCoverage}%</Label>
                    <Slider value={[insuranceCoverage]} onValueChange={(v) => setInsuranceCoverage(v[0])} min={0} max={100} step={10} />
                    <p className="text-xs text-muted-foreground">
                      Major procedures typically 50%, preventive care 80-100%
                    </p>
                  </div>
                )}
              </div>

              {/* Budget Ranges */}
              {budgetRanges && budgetRanges.length > 0 && (
                <div className="space-y-2">
                  <Label>Budget Ranges for {selectedTreatment?.name}</Label>
                  <div className="flex flex-wrap gap-2">
                    {budgetRanges.map((br: any) => (
                      <Badge key={br.id} variant="outline" className="py-1.5 px-3">
                        {br.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <Card>
            <CardHeader>
              <CardTitle>Price Estimate</CardTitle>
            </CardHeader>
            <CardContent>
              {costEstimate ? (
                <div className="space-y-6">
                  <div className="text-center p-6 bg-primary/5 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Average Price</p>
                    <p className="text-4xl font-bold text-primary">${costEstimate.avgPrice.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Range: ${costEstimate.minPrice.toLocaleString()} – ${costEstimate.maxPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Based on {costEstimate.count} dentist{costEstimate.count !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {hasInsurance && (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Insurance Pays</span>
                        <span className="font-medium text-green-600">-${costEstimate.insurancePays.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t pt-3">
                        <span className="font-medium">Your Out-of-Pocket</span>
                        <span className="font-bold text-lg">${costEstimate.outOfPocket.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <Button className="w-full" asChild>
                    <Link to={`/search?treatment=${selectedTreatment?.slug || ''}&state=${selectedState?.abbreviation || ''}`}>
                      <Search className="h-4 w-4 mr-2" />
                      Find Dentists in Your Budget
                    </Link>
                  </Button>
                </div>
              ) : treatmentId && budgetRanges && budgetRanges.length > 0 ? (
                <div className="space-y-6">
                  <div className="text-center p-6 bg-primary/5 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Estimated Price Range</p>
                    <p className="text-3xl font-bold text-primary">
                      ${Math.min(...budgetRanges.map((b: any) => b.price_min)).toLocaleString()} – ${Math.max(...budgetRanges.map((b: any) => b.price_max)).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Based on platform budget ranges
                    </p>
                  </div>
                  <div className="space-y-2">
                    {budgetRanges.map((br: any) => (
                      <div key={br.id} className="flex justify-between items-center py-2 px-3 bg-muted/30 rounded-lg text-sm">
                        <span className="font-medium">{br.label}</span>
                        <span className="text-muted-foreground">${br.price_min} – ${br.price_max}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" asChild>
                    <Link to={`/search?treatment=${selectedTreatment?.slug || ''}`}>
                      <Search className="h-4 w-4 mr-2" />
                      Find Dentists for This Treatment
                    </Link>
                  </Button>
                </div>
              ) : treatmentId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pricing data available for this treatment yet.</p>
                  <p className="text-sm mt-2">Try selecting a different treatment.</p>
                  <Button className="mt-4 w-full" variant="outline" asChild>
                    <Link to="/search">
                      <Search className="h-4 w-4 mr-2" />
                      Browse All Dentists
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a treatment to see cost estimates</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Dentists */}
        {costEstimate?.topClinics && costEstimate.topClinics.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Top-Rated Dentists for {selectedTreatment?.name}
              </CardTitle>
              <CardDescription>Verified dentists offering this treatment{selectedState ? ` in ${selectedState.name}` : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dentist</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Price Range</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costEstimate.topClinics.map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.clinic?.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.clinic?.cities?.name}, {item.clinic?.cities?.states?.abbreviation}
                      </TableCell>
                      <TableCell className="text-right">
                        ${item.from} {item.to > item.from ? `– $${item.to}` : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {item.clinic?.rating?.toFixed(1)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`/clinic/${item.clinic?.slug || item.clinic?.id}`}>
                            View <ArrowRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* FAQ */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Where does this pricing data come from?</h3>
              <p className="text-muted-foreground">
                All prices are submitted directly by verified dental offices on our platform. They reflect real pricing offered to patients.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Why do costs vary by location?</h3>
              <p className="text-muted-foreground">
                Dental costs depend on local cost of living, overhead expenses, and market competition. Urban areas typically have higher costs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">How can I get an accurate quote?</h3>
              <p className="text-muted-foreground">
                Request a consultation from 2-3 dentists in your area through AppointPanda for the most accurate pricing.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
