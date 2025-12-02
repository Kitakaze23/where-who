import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Home, Wifi, Plane, Cake, Heart } from "lucide-react";
import { format, isWithinInterval, addDays, isBefore, isAfter, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { ru } from "date-fns/locale";
import { DeskReservationDialog } from "@/components/DeskReservationDialog";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  position: string | null;
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

type EmployeeStatus = "office" | "remote" | "vacation" | "sick_leave" | "upcoming_vacation";

type DeskReservation = {
  id: string;
  employee_id: string;
  desk_number: number;
  start_date: string;
  end_date: string;
};

const Dashboard = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [sickLeaves, setSickLeaves] = useState<SickLeavePeriod[]>([]);
  const [filter, setFilter] = useState<EmployeeStatus | "all">("all");
  const [teamFilter, setTeamFilter] = useState<string | "all">("all");
  const [totalDesks, setTotalDesks] = useState<number>(0);
  const [reservations, setReservations] = useState<DeskReservation[]>([]);

  const getDayName = (date: Date) => {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return days[date.getDay()];
  };

  const getCurrentDayName = () => {
    return getDayName(new Date());
  };

  const getEmployeeStatusForDate = (employee: Employee, targetDate: Date): EmployeeStatus => {
    const checkDate = new Date(targetDate);
    checkDate.setHours(0, 0, 0, 0);
    const dayName = getDayName(checkDate);

    // Check if on sick leave (highest priority)
    const onSickLeave = sickLeaves.some((s) => {
      if (s.employee_id !== employee.id) return false;
      const start = new Date(s.start_date);
      const end = new Date(s.end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });

    if (onSickLeave) return "sick_leave";

    // Check if on vacation
    const onVacation = vacations.some((v) => {
      if (v.employee_id !== employee.id) return false;
      const start = new Date(v.start_date);
      const end = new Date(v.end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });

    if (onVacation) return "vacation";

    // Check if vacation is coming soon (within 2 weeks)
    const twoWeeksFromNow = addDays(checkDate, 14);
    const upcomingVacation = vacations.some((v) => {
      if (v.employee_id !== employee.id) return false;
      const start = new Date(v.start_date);
      start.setHours(0, 0, 0, 0);
      return start > checkDate && start <= twoWeeksFromNow;
    });

    if (upcomingVacation) return "upcoming_vacation";

    // Check if remote day
    if (employee.remote_days?.includes(dayName)) return "remote";

    return "office";
  };

  const getEmployeeStatus = (employee: Employee): EmployeeStatus => {
    return getEmployeeStatusForDate(employee, new Date());
  };

  const getAvailableDesksCount = (date: Date): number => {
    const peopleInOffice = employees.filter((emp) => {
      const status = getEmployeeStatusForDate(emp, date);
      return status === "office";
    }).length;
    return totalDesks - peopleInOffice;
  };

  const getCurrentVacationPeriod = (employee: Employee): VacationPeriod | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return vacations.find((v) => {
      if (v.employee_id !== employee.id) return false;
      const start = new Date(v.start_date);
      const end = new Date(v.end_date);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return today >= start && today <= end;
    }) || null;
  };

  const getUpcomingVacationPeriod = (employee: Employee): VacationPeriod | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoWeeksFromNow = addDays(today, 14);
    
    return vacations.find((v) => {
      if (v.employee_id !== employee.id) return false;
      const start = new Date(v.start_date);
      start.setHours(0, 0, 0, 0);
      return start > today && start <= twoWeeksFromNow;
    }) || null;
  };

  const isBirthdaySoon = (birthday: string | null): boolean => {
    if (!birthday) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthDate = new Date(birthday);
    
    // Set birth year to current year for comparison
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    thisYearBirthday.setHours(0, 0, 0, 0);
    
    // Check if birthday is today or within next 5 days
    const fiveDaysFromNow = addDays(today, 5);
    return (thisYearBirthday >= today) && (thisYearBirthday <= fiveDaysFromNow);
  };

  const getReservedDeskForDate = (employeeId: string, date: Date): number | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const reservation = reservations.find((r) => {
      if (r.employee_id !== employeeId) return false;
      return dateStr >= r.start_date && dateStr <= r.end_date;
    });
    return reservation ? reservation.desk_number : null;
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: employeesData } = await supabase.from("employees").select("*").order("last_name");
      const { data: vacationsData } = await supabase.from("vacation_periods").select("*");
      const { data: sickLeavesData } = await supabase.from("sick_leave_periods").select("*");
      const { data: reservationsData } = await supabase.from("desk_reservations").select("*");
      const { data: settingsData } = await supabase
        .from("settings")
        .select("*")
        .eq("setting_key", "total_desks")
        .maybeSingle();

      if (employeesData) setEmployees(employeesData);
      if (vacationsData) setVacations(vacationsData);
      if (sickLeavesData) setSickLeaves(sickLeavesData);
      if (reservationsData) setReservations(reservationsData);
      if (settingsData) setTotalDesks(parseInt(settingsData.setting_value));
    };

    fetchData();

    // Subscribe to changes
    const employeesChannel = supabase
      .channel("employees-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "employees" }, () => {
        fetchData();
      })
      .subscribe();

    const vacationsChannel = supabase
      .channel("vacations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "vacation_periods" }, () => {
        fetchData();
      })
      .subscribe();

    const sickLeavesChannel = supabase
      .channel("sick-leaves-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sick_leave_periods" }, () => {
        fetchData();
      })
      .subscribe();

    const settingsChannel = supabase
      .channel("settings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => {
        fetchData();
      })
      .subscribe();

    const reservationsChannel = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "desk_reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
      supabase.removeChannel(vacationsChannel);
      supabase.removeChannel(sickLeavesChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    const statusMatch = filter === "all" || getEmployeeStatus(emp) === filter;
    const teamMatch = teamFilter === "all" || emp.team === teamFilter;
    return statusMatch && teamMatch;
  });

  const uniqueTeams = Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[];

  const statusConfig = {
    office: { label: "В офисе", icon: Home, color: "bg-[hsl(var(--status-office))]", count: 0 },
    remote: { label: "Удалённо", icon: Wifi, color: "bg-[hsl(var(--status-remote))]", count: 0 },
    vacation: { label: "В отпуске", icon: Plane, color: "bg-[hsl(var(--status-vacation))]", count: 0 },
    sick_leave: { label: "На больничном", icon: Heart, color: "bg-[hsl(var(--status-sick))]", count: 0 },
    upcoming_vacation: { label: "Скоро отпуск", icon: Plane, color: "bg-[hsl(var(--status-upcoming-vacation))]", count: 0 },
  };

  employees.forEach((emp) => {
    const status = getEmployeeStatus(emp);
    statusConfig[status].count++;
  });

  const today = new Date();
  
  // Generate 2 weeks of dates starting from today
  const twoWeeksStart = today;
  const twoWeeksEnd = addDays(today, 13); // 2 weeks = 14 days
  const twoWeeksDates = eachDayOfInterval({ start: twoWeeksStart, end: twoWeeksEnd });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Дашборд сотрудников ОТР</h1>
            <p className="mt-2 text-muted-foreground">
              {format(new Date(), "d MMMM yyyy, EEEE", { locale: ru })}
            </p>
          </div>
          <Users className="h-12 w-12 text-primary" />
        </div>

        {/* Available Desks Table for 2 weeks */}
        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {twoWeeksDates.map((date, index) => (
                    <th key={index} className="px-2 py-3 text-center text-sm font-medium">
                      {format(date, "EEE", { locale: ru })}
                      <br />
                      <span className="text-xs text-muted-foreground">{format(date, "d MMM", { locale: ru })}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {twoWeeksDates.map((date, index) => {
                    const availableCount = getAvailableDesksCount(date);
                    return (
                      <td key={index} className="px-2 py-3 text-center text-lg font-bold">
                        {availableCount}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-center">
            <DeskReservationDialog />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          {(Object.keys(statusConfig) as EmployeeStatus[]).map((status) => {
            const config = statusConfig[status];
            const Icon = config.icon;
            return (
              <Card
                key={status}
                className="cursor-pointer p-6 transition-all hover:shadow-lg"
                onClick={() => setFilter(filter === status ? "all" : status)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
                    <p className="mt-2 text-3xl font-bold">{config.count}</p>
                  </div>
                  <div className={`rounded-full p-3 ${config.color} bg-opacity-10`}>
                    <Icon className={`h-6 w-6 ${config.color.replace("bg-", "text-")}`} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filter badges */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-2">Статус:</p>
            <div className="flex gap-2 flex-wrap">
              <Badge
                variant={filter === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilter("all")}
              >
                Все ({employees.length})
              </Badge>
              {(Object.keys(statusConfig) as EmployeeStatus[]).map((status) => (
                <Badge
                  key={status}
                  variant={filter === status ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilter(status)}
                >
                  {statusConfig[status].label} ({statusConfig[status].count})
                </Badge>
              ))}
            </div>
          </div>
          {uniqueTeams.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Команда:</p>
              <div className="flex gap-2 flex-wrap">
                <Badge
                  variant={teamFilter === "all" ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setTeamFilter("all")}
                >
                  Все команды
                </Badge>
                {uniqueTeams.map((team) => {
                  const teamCount = employees.filter((e) => e.team === team).length;
                  return (
                    <Badge
                      key={team}
                      variant={teamFilter === team ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setTeamFilter(team)}
                    >
                      {team} ({teamCount})
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Employees grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => {
            const status = getEmployeeStatus(employee);
            const statusInfo = statusConfig[status];
            const Icon = statusInfo.icon;
            const hasBirthdaySoon = isBirthdaySoon(employee.birthday);
            const currentVacation = status === "vacation" ? getCurrentVacationPeriod(employee) : null;
            const upcomingVacation = status === "upcoming_vacation" ? getUpcomingVacationPeriod(employee) : null;
            const reservedDesk = getReservedDeskForDate(employee.id, today);

            return (
              <Card key={employee.id} className="relative overflow-hidden p-6 transition-all hover:shadow-lg">
                {hasBirthdaySoon && (
                  <div className="absolute right-0 top-0 p-2">
                    <Cake className="h-5 w-5 text-[hsl(var(--status-birthday))] animate-pulse" />
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">
                        {employee.last_name} {employee.first_name}
                      </h3>
                      {employee.middle_name && (
                        <p className="text-sm text-muted-foreground">{employee.middle_name}</p>
                      )}
                      {employee.position && (
                        <p className="text-sm text-muted-foreground mt-1">{employee.position}</p>
                      )}
                      {employee.team && (
                        <p className="text-sm text-muted-foreground mt-1">Команда: {employee.team}</p>
                      )}
                    </div>
                    <div className={`rounded-full p-2 ${statusInfo.color} bg-opacity-10`}>
                      <Icon className={`h-4 w-4 ${statusInfo.color.replace("bg-", "text-")}`} />
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Стол:</span>
                      <span className="font-medium">
                        {employee.desk_number ? `№${employee.desk_number}` : "Не назначен"}
                      </span>
                    </div>
                    {reservedDesk && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Забронирован:</span>
                        <span className="font-medium text-blue-500">
                          №{reservedDesk}
                        </span>
                      </div>
                    )}
                    {employee.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Телефон:</span>
                        <span className="font-medium">{employee.phone}</span>
                      </div>
                    )}
                    {employee.birthday && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">День рождения:</span>
                        <span className="font-medium">
                          {format(new Date(employee.birthday), "d MMMM", { locale: ru })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                    
                    {currentVacation && (
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(currentVacation.start_date), "d MMM", { locale: ru })} - {format(new Date(currentVacation.end_date), "d MMM", { locale: ru })}
                      </div>
                    )}
                    
                    {upcomingVacation && (
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(upcomingVacation.start_date), "d MMM", { locale: ru })} - {format(new Date(upcomingVacation.end_date), "d MMM", { locale: ru })}
                      </div>
                    )}
                  </div>

                  {hasBirthdaySoon && (
                    <div className="rounded-lg bg-[hsl(var(--status-birthday))] bg-opacity-80 p-2 text-sm">
                      <p className="font-medium text-[hsl(var(--status-birthday2))]">
                        🎉 Скоро день рождения!
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {filteredEmployees.length === 0 && (
          <div className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg text-muted-foreground">Сотрудники не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;