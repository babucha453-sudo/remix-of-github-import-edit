import { Link } from "react-router-dom";

interface SEOContentSectionProps {
  locationName?: string;
  serviceName?: string;
  stateName?: string;
  variant: 'location' | 'service' | 'service-location' | 'listing';
  relatedLinks?: { label: string; href: string }[];
  dentistCount?: number;
  clinicCount?: number;
}

export function SEOContentSection({ 
  locationName, 
  serviceName, 
  stateName,
  variant, 
  relatedLinks,
  dentistCount = 0,
  clinicCount = 0
}: SEOContentSectionProps) {
  
  const renderLocationContent = () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Finding the Best Dentist in {locationName}{stateName ? `, ${stateName}` : ''}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          {locationName} is home to {clinicCount > 0 ? `over ${clinicCount}` : 'numerous'} highly-qualified dental professionals 
          offering a comprehensive range of services. Whether you need a routine dental checkup, cosmetic dentistry procedures 
          like teeth whitening, or specialized treatments such as dental implants or orthodontics, our directory connects you 
          with licensed dentists who meet the highest standards of patient care.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          The dental community in {locationName} includes general dentists, pediatric specialists, oral surgeons, 
          periodontists, and orthodontists. Many practices offer modern amenities including digital X-rays, same-day crowns, 
          and sedation dentistry options for anxious patients.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          All dental clinics listed on our platform have been verified for their credentials and patient reviews. 
          You can compare ratings, read authentic patient feedback, view before-and-after photos, and book appointments 
          directly through our secure online scheduling system.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Why Choose a Dentist in {locationName}?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Selecting a local dentist in {locationName} offers numerous advantages for your oral health journey. 
          Proximity to your dental care provider means easier access for routine visits, emergency appointments, 
          and follow-up care, which are all essential for maintaining optimal dental health.
        </p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Convenient neighborhood locations with easy parking and public transit access</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>State-of-the-art dental technology including digital imaging and laser dentistry</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Experienced dental teams serving diverse patient populations and family needs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Flexible scheduling with evening and weekend appointments available at many practices</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Direct insurance billing with most major dental insurance providers accepted</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Emergency dental services for urgent dental care needs</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          What to Look for When Choosing a Dentist
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Finding the right dentist involves considering several important factors. Look for practitioners with 
          strong educational backgrounds, relevant specializations, and positive patient testimonials. 
          Consider whether the practice offers the specific services you need, from preventive care to cosmetic procedures.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Don't hesitate to schedule a consultation to tour the facility, meet the dental team, and discuss your 
          treatment goals. A good dentist-patient relationship is built on trust, communication, and shared 
          commitment to your oral health.
        </p>
      </section>

      {relatedLinks && relatedLinks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Explore Nearby Areas
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Can't find exactly what you're looking for in {locationName}? Explore dentists in neighboring communities 
            to find the perfect match for your dental care needs.
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl px-4 py-2 text-sm font-bold transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const renderServiceContent = () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Understanding {serviceName}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          {serviceName} is one of the most sought-after dental treatments across the United States. Our network of 
          verified dental specialists offers this procedure using the latest techniques and technology to ensure 
          optimal results and maximum patient comfort throughout the treatment process.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Whether you're considering {serviceName?.toLowerCase()} for the first time or seeking a second opinion from 
          another qualified professional, our comprehensive directory connects you with experienced dental practitioners 
          who can guide you through every step of the process.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Modern {serviceName?.toLowerCase()} procedures have advanced significantly in recent years, with improved 
          materials, techniques, and outcomes. Many patients report minimal discomfort and are impressed by the 
          natural-looking results achieved by today's skilled dental professionals.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Benefits of {serviceName}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Patients who undergo {serviceName?.toLowerCase()} treatment often experience significant improvements in both 
          their oral health and overall quality of life. Here are some of the key benefits you can expect:
        </p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Improved oral health, dental function, and bite alignment</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Enhanced smile aesthetics and increased self-confidence</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Long-lasting results with proper care and regular dental maintenance</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Personalized treatment plans tailored to your unique dental needs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Prevention of future dental problems and complications</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Preparing for Your {serviceName} Appointment
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Before your {serviceName?.toLowerCase()} procedure, your dentist will conduct a thorough examination and 
          discuss your treatment options. This may include X-rays, dental impressions, or digital scans to create 
          a customized treatment plan.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Be sure to discuss any medications you're taking, your complete medical history, and any concerns you 
          have about the procedure. Your dental team is there to ensure you feel comfortable and informed throughout 
          your treatment journey.
        </p>
      </section>

      {relatedLinks && relatedLinks.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Related Dental Services
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Explore other dental treatments that may complement your {serviceName?.toLowerCase()} procedure 
            or address additional oral health needs.
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl px-4 py-2 text-sm font-bold transition-all"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  const renderServiceLocationContent = () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {serviceName} in {locationName}{stateName ? `, ${stateName}` : ''}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Looking for {serviceName?.toLowerCase()} specialists in {locationName}? Our comprehensive directory features 
          {dentistCount > 0 ? ` ${dentistCount}+` : ''} verified dental professionals who specialize in this treatment 
          and proudly serve patients throughout the {locationName} area and surrounding communities.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Each dentist in our network has been carefully vetted for their credentials, experience, and commitment to 
          patient satisfaction. You can compare ratings based on authentic patient reviews, view treatment photos, 
          and book your consultation with complete confidence.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          {serviceName} treatments in {locationName} are performed using the latest dental technology and techniques. 
          Many local practices offer financing options and accept a wide range of dental insurance plans to make 
          quality care accessible to all patients.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Why Choose {locationName} for {serviceName}?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          {locationName} has become a destination for quality dental care, with practices equipped with 
          cutting-edge technology and staffed by highly trained professionals. Here's why patients choose 
          local providers for their {serviceName?.toLowerCase()} needs:
        </p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Access to top-rated {serviceName?.toLowerCase()} specialists in your local community</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Convenient appointment times including early morning, evening, and weekend options</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Competitive pricing with transparent cost estimates and flexible payment plans</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Comprehensive follow-up care and ongoing support close to your home</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Modern facilities with the latest dental equipment and sterilization protocols</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          What to Expect During Your {serviceName} Consultation
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Your first {serviceName?.toLowerCase()} consultation in {locationName} will typically include a comprehensive 
          oral examination, discussion of your treatment goals, and a detailed explanation of your options. 
          Many dentists offer complimentary consultations for major procedures.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          During your visit, don't hesitate to ask about the dentist's experience with {serviceName?.toLowerCase()}, 
          view before-and-after photos of previous patients, and discuss the timeline and recovery process. 
          A good dentist will take the time to address all your questions and concerns.
        </p>
      </section>
    </div>
  );

  const renderListingContent = () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          How to Choose the Right Dentist
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Finding the right dentist is one of the most important decisions you can make for your oral health and 
          overall wellbeing. Our platform simplifies this process by allowing you to compare verified dental 
          professionals based on their expertise, patient reviews, location, and availability.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Look for dentists with consistently strong patient ratings, relevant specializations for your needs, 
          convenient office locations, and appointment times that fit your schedule. Consider factors like 
          insurance acceptance, payment options, and the range of services offered.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          All profiles on our platform include verified credentials, authentic patient feedback, and detailed 
          information about each practice. You can view photos, read reviews, and even take virtual tours of 
          many dental offices before scheduling your first appointment.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          What to Expect from Your Dental Visit
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Whether you're scheduling a routine cleaning or a specialized procedure, knowing what to expect 
          can help you feel more comfortable and prepared for your dental appointment.
        </p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>A professional, welcoming environment focused on patient comfort and care</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Thorough examination with personalized treatment recommendations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Clear communication about all treatment options, procedures, and costs</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Easy online booking and convenient appointment management tools</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Follow-up care instructions and scheduling for any necessary treatments</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Questions to Ask Your New Dentist
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          When meeting with a new dentist, it's important to ask the right questions to ensure they're 
          the right fit for your dental care needs. Consider asking about:
        </p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Their experience and training in specific procedures you may need</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Emergency care availability and after-hours contact information</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Insurance acceptance and available payment or financing options</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">•</span>
            <span>Their approach to preventive care and patient education</span>
          </li>
        </ul>
      </section>
    </div>
  );

  return (
    <div className="card-modern p-8 max-w-4xl">
      {variant === 'location' && renderLocationContent()}
      {variant === 'service' && renderServiceContent()}
      {variant === 'service-location' && renderServiceLocationContent()}
      {variant === 'listing' && renderListingContent()}
    </div>
  );
}
