import { Metadata } from "next";
import ContactContent from "./ContactContent";

export const metadata: Metadata = {
  title: "Contact Weered",
  description: "Get in touch with Weered. No ticket system, no chatbot. Just send a message.",
  openGraph: {
    title: "Contact Weered",
    description: "Get in touch with Weered. Send us a message directly.",
    url: "https://weered.ca/contact",
  },
  twitter: {
    title: "Contact Weered",
    description: "Get in touch with Weered. Send us a message directly.",
  },
  alternates: { canonical: "https://weered.ca/contact" },
};

export default function ContactPage() {
  return <ContactContent />;
}
