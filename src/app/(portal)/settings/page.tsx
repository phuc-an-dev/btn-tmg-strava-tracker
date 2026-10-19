import {pageMetadata} from '@/lib/page-metadata';
import {SettingsPanel} from '@/components/settings-panel';

export const metadata=pageMetadata('/settings');
export default function Page(){return <SettingsPanel/>;}
