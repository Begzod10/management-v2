import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Globe } from "lucide-react";

const BRANCH_SITES: Record<string, { label: string; domain: string }> = {
  chorvoq: { label: "Chorvoq", domain: "chorvoq.tisedu.uz" },
  chirchiq: { label: "Chirchiq", domain: "chirchiq.tisedu.uz" },
  sergeli: { label: "Sergeli", domain: "sergeli.tisedu.uz" },
};

// Each branch's public site ships its own admin panel (/admin login,
// /admin/dashboard, /editable/* inline-edit routes) — this page just links
// out to it rather than embedding a separate app inside management.
const SmmWebsiteChangePage = () => {
  const { branch = "" } = useParams<{ branch: string }>();
  const site = BRANCH_SITES[branch];
  const branchLabel = site?.label ?? branch;
  const adminUrl = site ? `https://${site.domain}/admin` : null;

  return (
    <DashboardLayout title={`${branchLabel} — Web site change`}>
      <Card>
        <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-4 text-muted-foreground">
          <Globe className="h-8 w-8" />
          {adminUrl ? (
            <>
              <p className="text-sm">
                {branchLabel} saytini tahrirlash uchun uning admin paneliga o'ting.
              </p>
              <Button asChild>
                <a href={adminUrl} target="_blank" rel="noopener noreferrer">
                  Saytga o'tish <ExternalLink className="h-4 w-4 ml-1.5" />
                </a>
              </Button>
              <p className="text-xs text-muted-foreground/70">{site.domain}/admin</p>
            </>
          ) : (
            <p className="text-sm">Noma'lum filial: {branch}</p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default SmmWebsiteChangePage;
