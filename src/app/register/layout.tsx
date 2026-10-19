import type {ReactNode} from "react";
import {pageMetadata} from "@/lib/page-metadata";

export const metadata=pageMetadata("/register");
export default function Layout({children}:{children:ReactNode}) { return children; }
