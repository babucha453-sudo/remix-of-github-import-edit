import type { GetStaticProps } from "next";
import InsurancePage from "@/pages/InsurancePage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default InsurancePage;


