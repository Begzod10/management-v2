import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Wallet, ReceiptText } from "lucide-react";

const sections = [
  {
    title: "O'quvchilar Qarzdorligi",
    desc: "O'quvchi qarzdorliklarini kuzatib borish",
    href: "/finance/debtors",
    icon: Users,
  },
  {
    title: "Oyliklar",
    desc: "O'qituvchi va xodimlar oyliklarini boshqarish",
    href: "/finance/salaries",
    icon: Wallet,
  },
  {
    title: "Qo'shimcha Xarajatlar",
    desc: "Qo'shimcha xarajatlarni boshqarish",
    href: "/finance/overheads",
    icon: ReceiptText,
  },
];

export default function FinancePage() {
  const navigate = useNavigate();
  return (
    <DashboardLayout title="Moliya Boshqarma">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((s) => (
          <Card
            key={s.href}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => navigate(s.href)}
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">{s.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
