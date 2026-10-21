import { view } from '@/modules/fridge';
import { loadCatalog, todayFor } from '@/modules/fridge/data';
import { getSessionUser } from '@/platform/auth';
import { redirect } from 'next/navigation';
import FridgeClient from './FridgeClient';

export default async function FridgePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const [catalog, today, initial] = await Promise.all([loadCatalog(), todayFor(user.id), view(user.id)]);
  return <FridgeClient initial={initial} ingredients={catalog.ingredients} categories={catalog.categories} today={today} />;
}
