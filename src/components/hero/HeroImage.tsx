import heroSmileImage from "@/assets/hero-smile.jpg";
import { motion } from "framer-motion";

export const HeroImage = () => {
  return (
    <div className="relative w-full max-w-md mx-auto lg:max-w-none">
      {/* Main image with curved mask */}
      <motion.div 
        className="relative rounded-[2rem] lg:rounded-[3rem] overflow-hidden shadow-2xl shadow-primary/20"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <img
          src={heroSmileImage as unknown as string}
          alt="Happy dental patient with a bright smile"
          width={800}
          height={600}
          loading="eager"
          fetchPriority="high"
          className="w-full h-auto object-cover aspect-[16/10] lg:aspect-[4/3]"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
        
        {/* Floating badge */}
        <motion.div 
          className="absolute bottom-3 left-3 right-3 md:bottom-5 md:left-5 md:right-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-3 py-2.5 md:px-4 md:py-3 shadow-lg">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] md:text-xs font-bold text-muted-foreground">VERIFIED CLINICS</p>
                <p className="text-xs md:text-sm font-bold text-foreground">500+ Across USA</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Decorative elements */}
      <motion.div 
        className="absolute -top-4 -right-4 w-20 md:w-24 h-20 md:h-24 bg-primary/20 rounded-full blur-2xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div 
        className="absolute -bottom-4 -left-4 w-16 md:w-20 h-16 md:h-20 bg-teal/20 rounded-full blur-2xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.25, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, delay: 1 }}
      />
    </div>
  );
};
