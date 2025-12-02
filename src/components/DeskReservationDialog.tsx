import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameWeek, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  desk_number: number | null;
};

type DeskReservation = {
  id: string;
  employee_id: string;
  desk_number: number;
  start_date: string;
  end_date: string;
};

export function DeskReservationDialog() {
  const [open, setOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedDesk, setSelectedDesk] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reservations, setReservations] = useState<DeskReservation[]>([]);
  const [totalDesks, setTotalDesks] = useState<number>(0);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    const { data: employeesData } = await supabase.from("employees").select("id, first_name, last_name, middle_name, desk_number").order("last_name");
    const { data: reservationsData } = await supabase.from("desk_reservations").select("*");
    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("setting_key", "total_desks")
      .maybeSingle();

    if (employeesData) setEmployees(employeesData);
    if (reservationsData) setReservations(reservationsData);
    if (settingsData) setTotalDesks(parseInt(settingsData.setting_value));
  };

  const isDeskAvailable = (deskNumber: number, startDate: Date, endDate: Date): boolean => {
    return !reservations.some((res) => {
      if (res.desk_number !== deskNumber) return false;
      const resStart = new Date(res.start_date);
      const resEnd = new Date(res.end_date);
      return (startDate <= resEnd && endDate >= resStart);
    });
  };

  const handleReserve = async () => {
    if (!selectedEmployeeId || !selectedDesk || !dateRange?.from || !dateRange?.to) {
      toast.error("Заполните все поля");
      return;
    }

    // Check if dates are in the same week
    if (!isSameWeek(dateRange.from, dateRange.to, { locale: ru })) {
      toast.error("Бронирование возможно только в рамках одной недели");
      return;
    }

    const deskNumber = parseInt(selectedDesk);

    // Check if desk is available
    if (!isDeskAvailable(deskNumber, dateRange.from, dateRange.to)) {
      toast.error("Этот стол уже занят в выбранные даты");
      return;
    }

    const { error } = await supabase.from("desk_reservations").insert({
      employee_id: selectedEmployeeId,
      desk_number: deskNumber,
      start_date: format(dateRange.from, "yyyy-MM-dd"),
      end_date: format(dateRange.to, "yyyy-MM-dd"),
    });

    if (error) {
      toast.error("Ошибка при бронировании");
      console.error(error);
      return;
    }

    toast.success("Стол успешно забронирован");
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedEmployeeId("");
    setSelectedDesk("");
    setDateRange(undefined);
  };

  const availableDesks = Array.from({ length: totalDesks }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">Забронировать место</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Бронирование стола</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Сотрудник</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.last_name} {emp.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Номер стола</Label>
            <Select value={selectedDesk} onValueChange={setSelectedDesk}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите стол" />
              </SelectTrigger>
              <SelectContent>
                {availableDesks.map((desk) => (
                  <SelectItem key={desk} value={desk.toString()}>
                    Стол №{desk}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Период бронирования (в рамках одной недели)</Label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {dateRange?.from ? format(dateRange.from, "d MMM", { locale: ru }) : "Начало"} -{" "}
                  {dateRange?.to ? format(dateRange.to, "d MMM", { locale: ru }) : "Конец"}
                </span>
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={ru}
                className={cn("rounded-md border pointer-events-auto")}
                disabled={(date) => date < new Date()}
              />
            </div>
          </div>

          <Button onClick={handleReserve} className="w-full">
            Забронировать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
