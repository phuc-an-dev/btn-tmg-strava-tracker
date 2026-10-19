import {Suspense} from 'react';
import {ContributionsPage} from '@/components/contributions-page';
import {pageMetadata} from '@/lib/page-metadata';
export const metadata=pageMetadata('/contributions');
export default function Page(){return <Suspense><ContributionsPage/></Suspense>;}
