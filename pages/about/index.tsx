import type { GetStaticProps } from "next";
import AboutPage from "@/pages/AboutPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600, // Revalidate every hour
  };
};

export default AboutPage;


