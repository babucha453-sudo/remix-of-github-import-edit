import type { GetStaticProps } from "next";
import PrivacyPage from "@/pages/PrivacyPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default PrivacyPage;


