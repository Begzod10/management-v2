import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export type Institution = "gennis" | "turon";

interface SystemModel { id: number; name: string; }

interface InstitutionContextType {
  institution: Institution;
  institutionName: string;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  systemModels: SystemModel[];
  modelsLoading: boolean;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: React.ReactNode }) {
  const [systemModels, setSystemModels] = useState<SystemModel[]>([]);
  const [selectedModelId, setSelectedModelIdState] = useState<string>(
    () => localStorage.getItem("selectedModelId") ?? ""
  );
  const [modelsLoading, setModelsLoading] = useState(true);

  const setSelectedModelId = (id: string) => {
    localStorage.setItem("selectedModelId", id);
    setSelectedModelIdState(id);
  };

  useEffect(() => {
    apiFetch("/system-models/")
      .then((r) => r.ok ? r.json() : [])
      .then((data: SystemModel[]) => {
        setSystemModels(data);
        const saved = localStorage.getItem("selectedModelId");
        const valid = saved && data.some((m: SystemModel) => String(m.id) === saved);
        if (!valid && data.length > 0) setSelectedModelId(String(data[0].id));
      })
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, []);

  const selectedModel = systemModels.find((m) => String(m.id) === selectedModelId);
  const institutionName = selectedModel?.name ?? "";
  const institution: Institution =
    institutionName.toLowerCase().includes("turon") ? "turon" : "gennis";

  return (
    <InstitutionContext.Provider value={{ institution, institutionName, selectedModelId, setSelectedModelId, systemModels, modelsLoading }}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (!context) throw new Error("useInstitution must be used within InstitutionProvider");
  return context;
}
