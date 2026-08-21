import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[400px] text-center">
        <CardHeader>
          <CardTitle>Parolni tiklash</CardTitle>
          <CardDescription>Bu funksiya hozircha mavjud emas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/login")} className="w-full">
            Loginga qaytish
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
