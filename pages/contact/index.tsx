import type { GetStaticProps } from "next";
import ContactPage from "@/pages/ContactPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default ContactPage;


