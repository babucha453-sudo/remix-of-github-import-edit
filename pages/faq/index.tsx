import type { GetStaticProps } from "next";
import FAQPage from "@/pages/FAQPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default FAQPage;


