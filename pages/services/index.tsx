import type { GetStaticProps } from "next";
import ServicesPage from "@/pages/ServicesPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default ServicesPage;


