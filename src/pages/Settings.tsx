import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  team: string | null;
  desk_number: number | null;
  phone: string | null;
  birthday: string | null;
  remote_days: string[];
};

type VacationPeriod = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
};

type SickLeavePeriod = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
};

const WEEKDAYS = [
  { value: "monday", label: "Понедельник" },
  { value: "tuesday", label: "Вторник" },
  { value: "wednesday", label: "Среда" },
  { value: "thursday", label: "Четверг" },
  { value: "friday", label: "Пятница" },
  { value: "saturday", label: "Суббота" },
  { value: "sunday", label: "Воскресенье" },
];

const Settings = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [sickLeaves, setSickLeaves] = useState<SickLeavePeriod[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    team: "",
    desk_number: "",
    phone: "",
    birthday: "",
    remote_days: [] as string[],
  });
  const [vacationForm, setVacationForm] = useState({
    start_date: "",
    end_date: "",
  });
  const [sickLeaveForm, setSickLeaveForm] = useState({
    start_date: "",
    end_date: "",
  });

  const fetchEmployees = async () => {
    const { data } = await supabase.from("employees").select("*").order("last_name");
    if (data) setEmployees(data);
  };

  const fetchVacations = async () => {
    const { data } = await supabase.from("vacation_periods").select("*");
    if (data) setVacations(data);
  };

  const fetchSickLeaves = async () => {
    const { data } = await supabase.from("sick_leave_periods").select("*");
    if (data) setSickLeaves(data);
  };

  useEffect(() => {
    fetchEmployees();
    fetchVacations();
    fetchSickLeaves();
  }, []);

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      middle_name: "",
      team: "",
      desk_number: "",
      phone: "",
      birthday: "",
      remote_days: [],
    });
    setVacationForm({ start_date: "", end_date: "" });
    setSickLeaveForm({ start_date: "", end_date: "" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const employeeData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      middle_name: formData.middle_name || null,
      team: formData.team || null,
      desk_number: formData.desk_number ? parseInt(formData.desk_number) : null,
      phone: formData.phone || null,
      birthday: formData.birthday || null,
      remote_days: formData.remote_days,
    };

    if (editingId) {
      const { error } = await supabase.from("employees").update(employeeData).eq("id", editingId);
      if (error) {
        toast.error("Ошибка при обновлении сотрудника");
        return;
      }
      toast.success("Сотрудник успешно обновлён");
    } else {
      const { data: newEmployee, error } = await supabase
        .from("employees")
        .insert(employeeData)
        .select()
        .single();

      if (error) {
        toast.error("Ошибка при добавлении сотрудника");
        return;
      }

      // Add vacation period if provided
      if (newEmployee && vacationForm.start_date && vacationForm.end_date) {
        await supabase.from("vacation_periods").insert({
          employee_id: newEmployee.id,
          start_date: vacationForm.start_date,
          end_date: vacationForm.end_date,
        });
        fetchVacations();
      }

      // Add sick leave period if provided
      if (newEmployee && sickLeaveForm.start_date && sickLeaveForm.end_date) {
        await supabase.from("sick_leave_periods").insert({
          employee_id: newEmployee.id,
          start_date: sickLeaveForm.start_date,
          end_date: sickLeaveForm.end_date,
        });
        fetchSickLeaves();
      }

      toast.success("Сотрудник успешно добавлен");
    }

    fetchEmployees();
    resetForm();
  };

  const handleEdit = (employee: Employee) => {
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      middle_name: employee.middle_name || "",
      team: employee.team || "",
      desk_number: employee.desk_number?.toString() || "",
      phone: employee.phone || "",
      birthday: employee.birthday || "",
      remote_days: employee.remote_days || [],
    });
    setEditingId(employee.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить этого сотрудника?")) return;

    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      toast.error("Ошибка при удалении сотрудника");
      return;
    }

    toast.success("Сотрудник успешно удалён");
    fetchEmployees();
  };

  const toggleRemoteDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      remote_days: prev.remote_days.includes(day)
        ? prev.remote_days.filter((d) => d !== day)
        : [...prev.remote_days, day],
    }));
  };

  const getEmployeeVacations = (employeeId: string) => {
    return vacations.filter((v) => v.employee_id === employeeId);
  };

  const getEmployeeSickLeaves = (employeeId: string) => {
    return sickLeaves.filter((s) => s.employee_id === employeeId);
  };

  const deleteVacation = async (vacationId: string) => {
    const { error } = await supabase.from("vacation_periods").delete().eq("id", vacationId);
    if (error) {
      toast.error("Ошибка при удалении отпуска");
      return;
    }
    toast.success("Отпуск удалён");
    fetchVacations();
  };

  const deleteSickLeave = async (sickLeaveId: string) => {
    const { error } = await supabase.from("sick_leave_periods").delete().eq("id", sickLeaveId);
    if (error) {
      toast.error("Ошибка при удалении больничного");
      return;
    }
    toast.success("Больничный удалён");
    fetchSickLeaves();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">Настройки сотрудников</h1>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Отмена" : "Добавить сотрудника"}
          </Button>
        </div>

        {showForm && (
          <Card className="p-6">
            <h2 className="mb-4 text-2xl font-semibold">
              {editingId ? "Редактировать сотрудника" : "Добавить нового сотрудника"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Фамилия *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Имя *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Отчество</Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="team">Команда</Label>
                  <Input
                    id="team"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    placeholder="Название команды"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desk_number">Номер стола</Label>
                  <Input
                    id="desk_number"
                    type="number"
                    value={formData.desk_number}
                    onChange={(e) => setFormData({ ...formData, desk_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthday">День рождения</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Дни удалённой работы</Label>
                <div className="grid gap-3 md:grid-cols-4">
                  {WEEKDAYS.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={day.value}
                        checked={formData.remote_days.includes(day.value)}
                        onCheckedChange={() => toggleRemoteDay(day.value)}
                      />
                      <Label htmlFor={day.value} className="cursor-pointer">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {!editingId && (
                <>
                  <div className="space-y-2">
                    <Label>Добавить отпуск (опционально)</Label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="vacation_start">С даты</Label>
                        <Input
                          id="vacation_start"
                          type="date"
                          value={vacationForm.start_date}
                          onChange={(e) =>
                            setVacationForm({ ...vacationForm, start_date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vacation_end">По дату</Label>
                        <Input
                          id="vacation_end"
                          type="date"
                          value={vacationForm.end_date}
                          onChange={(e) =>
                            setVacationForm({ ...vacationForm, end_date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Добавить больничный (опционально)</Label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="sick_leave_start">С даты</Label>
                        <Input
                          id="sick_leave_start"
                          type="date"
                          value={sickLeaveForm.start_date}
                          onChange={(e) =>
                            setSickLeaveForm({ ...sickLeaveForm, start_date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sick_leave_end">По дату</Label>
                        <Input
                          id="sick_leave_end"
                          type="date"
                          value={sickLeaveForm.end_date}
                          onChange={(e) =>
                            setSickLeaveForm({ ...sickLeaveForm, end_date: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button type="submit">{editingId ? "Сохранить" : "Добавить"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Отмена
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Список сотрудников</h2>
          <div className="grid gap-4">
            {employees.map((employee) => {
              const employeeVacations = getEmployeeVacations(employee.id);
              const employeeSickLeaves = getEmployeeSickLeaves(employee.id);
              return (
                <Card key={employee.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {employee.last_name} {employee.first_name} {employee.middle_name}
                        </h3>
                        <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                          {employee.team && (
                            <p>
                              <span className="text-muted-foreground">Команда:</span>{" "}
                              {employee.team}
                            </p>
                          )}
                          <p>
                            <span className="text-muted-foreground">Стол:</span>{" "}
                            {employee.desk_number || "—"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Телефон:</span>{" "}
                            {employee.phone || "—"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">День рождения:</span>{" "}
                            {employee.birthday
                              ? format(new Date(employee.birthday), "dd.MM.yyyy")
                              : "—"}
                          </p>
                          <p className="md:col-span-2">
                            <span className="text-muted-foreground">Удалённо:</span>{" "}
                            {employee.remote_days?.length > 0
                              ? employee.remote_days
                                  .map((d) => WEEKDAYS.find((w) => w.value === d)?.label)
                                  .join(", ")
                              : "Нет"}
                          </p>
                        </div>
                      </div>

                      {employeeVacations.length > 0 && (
                        <div className="space-y-2">
                          <p className="font-medium">Отпуска:</p>
                          {employeeVacations.map((vacation) => (
                            <div
                              key={vacation.id}
                              className="flex items-center justify-between rounded-lg bg-muted p-2"
                            >
                              <span className="text-sm">
                                {format(new Date(vacation.start_date), "dd.MM.yyyy")} —{" "}
                                {format(new Date(vacation.end_date), "dd.MM.yyyy")}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteVacation(vacation.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {employeeSickLeaves.length > 0 && (
                        <div className="space-y-2">
                          <p className="font-medium">Больничные:</p>
                          {employeeSickLeaves.map((sickLeave) => (
                            <div
                              key={sickLeave.id}
                              className="flex items-center justify-between rounded-lg bg-muted p-2"
                            >
                              <span className="text-sm">
                                {format(new Date(sickLeave.start_date), "dd.MM.yyyy")} —{" "}
                                {format(new Date(sickLeave.end_date), "dd.MM.yyyy")}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteSickLeave(sickLeave.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(employee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(employee.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {employees.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Сотрудники ещё не добавлены</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;