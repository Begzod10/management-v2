import { useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Globe } from "lucide-react";
import { apiFetch } from "@/lib/api";

const BRANCH_SITES: Record<string, { label: string; domain: string; path?: string; sso?: boolean }> = {
  chorvoq: { label: "Chorvoq", domain: "chorvoq.tisedu.uz" },
  chirchiq: { label: "Chirchiq", domain: "chirchiq.tisedu.uz" },
  sergeli: { label: "Sergeli", domain: "sergeli.tisedu.uz" },
  // gennis-home is a separate standalone site (not a Turon branch) — its
  // admin login lives at /login, not /admin like the Turon branch sites.
  // It supports true SSO via /auth/gennis-sso, which mints a bridge token
  // signed with a dedicated SSO_SHARED_SECRET (not this project's
  // SECRET_KEY) that gennis-v2's /auth/sso-exchange trades for a real
  // session — so this button can drop the user straight into /platform
  // with no login prompt.
  gennis: { label: "Gennis", domain: "gennis.uz", path: "/login", sso: true },
};

// Each branch's public site ships its own admin panel (/admin login,
// /admin/dashboard, /editable/* inline-edit routes) — this page just links
// out to it rather than embedding a separate app inside management.
const SmmWebsiteChangePage = () => {
  const { branch = "" } = useParams<{ branch: string }>();
  const site = BRANCH_SITES[branch];
  const branchLabel = site?.label ?? branch;
  const adminUrl = site ? `https://${site.domain}${site.path ?? "/admin"}` : null;

  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState(false);

  const handleSsoClick = async () => {
    setSsoLoading(true);
    setSsoError(false);
    try {
      const res = await apiFetch("/auth/gennis-sso");
      if (!res.ok) throw new Error("sso_failed");
      const data = await res.json();
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setSsoError(true);
    } finally {
      setSsoLoading(false);
    }
  };

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
              {site.sso ? (
                <>
                  <Button onClick={handleSsoClick} disabled={ssoLoading}>
                    {ssoLoading ? "Yuklanmoqda..." : "Saytga o'tish"} <ExternalLink className="h-4 w-4 ml-1.5" />
                  </Button>
                  {ssoError && (
                    <p className="text-xs text-destructive">
                      Kirishda xatolik yuz berdi. Qayta urinib ko'ring.
                    </p>
                  )}
                </>
              ) : (
                <Button asChild>
                  <a href={adminUrl} target="_blank" rel="noopener noreferrer">
                    Saytga o'tish <ExternalLink className="h-4 w-4 ml-1.5" />
                  </a>
                </Button>
              )}
              <p className="text-xs text-muted-foreground/70">{site.domain}{site.path ?? "/admin"}</p>
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
