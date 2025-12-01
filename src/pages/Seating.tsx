import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  desk_number: number | null;
};

type OfficeLayout = {
  id: string;
  image_url: string;
};

const Seating = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchLayout();

    // Subscribe to real-time changes
    const employeesChannel = supabase
      .channel("seating-employees-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, fetchEmployees)
      .subscribe();

    const layoutChannel = supabase
      .channel("seating-layout-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "office_layout" }, fetchLayout)
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
      supabase.removeChannel(layoutChannel);
    };
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("id, first_name, last_name, middle_name, desk_number")
      .not("desk_number", "is", null)
      .order("desk_number");

    if (data) setEmployees(data);
  };

  const fetchLayout = async () => {
    const { data } = await supabase
      .from("office_layout")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) setLayout(data);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите изображение (JPG или PNG)");
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `office-layouts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("office_layouts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("office_layouts").getPublicUrl(filePath);

      // Save to database
      const { error: dbError } = await supabase.from("office_layout").insert({
        image_url: publicUrl,
      });

      if (dbError) throw dbError;

      toast.success("Схема офиса успешно загружена");
      fetchLayout();
    } catch (error) {
      console.error("Error uploading layout:", error);
      toast.error("Ошибка при загрузке схемы офиса");
    } finally {
      setUploading(false);
    }
  };

  const deleteLayout = async () => {
    if (!layout) return;
    if (!confirm("Вы уверены, что хотите удалить схему офиса?")) return;

    try {
      // Extract file path from URL
      const url = new URL(layout.image_url);
      const filePath = url.pathname.split("/storage/v1/object/public/office_layouts/")[1];

      // Delete from storage
      if (filePath) {
        await supabase.storage.from("office_layouts").remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase.from("office_layout").delete().eq("id", layout.id);

      if (error) throw error;

      toast.success("Схема офиса удалена");
      setLayout(null);
    } catch (error) {
      console.error("Error deleting layout:", error);
      toast.error("Ошибка при удалении схемы");
    }
  };

  // Group employees by desk number
  const employeesByDesk = employees.reduce((acc, emp) => {
    if (emp.desk_number) {
      acc[emp.desk_number] = emp;
    }
    return acc;
  }, {} as Record<number, Employee>);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Рассадка сотрудников</h1>
            <p className="mt-2 text-muted-foreground">Схема офиса и расположение столов</p>
          </div>
          <MapPin className="h-12 w-12 text-primary" />
        </div>

        {/* Office Layout */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Схема офиса</h2>
              <div className="flex gap-2">
                <Button asChild disabled={uploading} className="gap-2">
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Загрузка..." : "Загрузить схему"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                  </label>
                </Button>
                {layout && (
                  <Button variant="outline" onClick={deleteLayout} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </Button>
                )}
              </div>
            </div>

            {layout ? (
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={layout.image_url}
                  alt="Схема офиса"
                  className="h-auto w-full object-contain"
                />
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted p-12 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  Схема офиса не загружена. Загрузите изображение (JPG или PNG)
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Desk List */}
        <Card className="p-6">
          <h2 className="mb-6 text-2xl font-semibold">Список рассадки по столам</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(employeesByDesk)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([deskNumber, employee]) => (
                <Card key={deskNumber} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span className="text-lg font-bold">{deskNumber}</span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {employee.last_name} {employee.first_name}
                      </p>
                      {employee.middle_name && (
                        <p className="text-sm text-muted-foreground">{employee.middle_name}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
          </div>

          {employees.length === 0 && (
            <div className="py-12 text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg text-muted-foreground">
                Нет сотрудников с назначенными столами
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Seating;
