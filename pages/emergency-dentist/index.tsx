import type { GetStaticProps } from "next";
import EmergencyDentist from "@/pages/EmergencyDentist";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default EmergencyDentist;


