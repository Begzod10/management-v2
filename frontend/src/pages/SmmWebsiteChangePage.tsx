import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Globe } from "lucide-react";

const BRANCH_LABELS: Record<string, string> = {
  chorvoq: "Chorvoq",
  chirchiq: "Chirchiq",
  sergeli: "Sergeli",
};

// Placeholder page — one component reused for all three branches via the
// :branch route param. Content/logic to be filled in later.
const SmmWebsiteChangePage = () => {
  const { branch = "" } = useParams<{ branch: string }>();
  const branchLabel = BRANCH_LABELS[branch] ?? branch;

  return (
    <DashboardLayout title={`${branchLabel} — Web site change`}>
      <Card>
        <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
          <Globe className="h-8 w-8" />
          <p className="text-sm">
            {branchLabel} sayti uchun o'zgartirish bo'limi tez orada tayyor bo'ladi.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default SmmWebsiteChangePage;
