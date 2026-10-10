import type { Metadata } from "next";
import { Book } from "@/components/book/book";

export const metadata: Metadata = { title: "Book" };

export default function PortfolioPage() {
  return <Book />;
}
