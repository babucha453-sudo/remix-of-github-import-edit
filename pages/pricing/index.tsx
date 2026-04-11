import type { GetStaticProps } from "next";
import PricingPage from "@/pages/PricingPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default PricingPage;


