import { NotImplemented } from "@/ui/NotImplemented";

export default function FridgePage() {
  return (
    <NotImplemented
      title="Your fridge"
      owner="Receipts & Fridge"
      spec="FRG1-FRG5"
      v={1}
      purpose="See everything you have, soonest-to-expire first, and the dishes you can cook right now."
    />
  );
}
