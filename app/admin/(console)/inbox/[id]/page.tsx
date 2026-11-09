import { ConversationPage } from "@/components/conversation-page";

export default async function InboxMessage({ params,searchParams }: { params:Promise<{id:string}>;searchParams:Promise<{before?:string}> }) {
  const [{ id },{ before }] = await Promise.all([params,searchParams]);
  return <ConversationPage id={id} before={before} staff />;
}
