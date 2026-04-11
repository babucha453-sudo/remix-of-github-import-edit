import type { GetStaticProps } from "next";
import HowItWorksPage from "@/pages/HowItWorksPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default HowItWorksPage;


