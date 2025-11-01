import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Settings, MapPin, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const links = [
    { href: "/", label: "Дашборд", icon: Home },
    { href: "/seating", label: "Рассадка", icon: MapPin },
    { href: "/settings", label: "Настройки", icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    navigate("/login");
    toast.success("Вы вышли из системы");
  };

  return (
    <nav className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Office Tracker</span>
          </div>

          <div className="flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href;

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              );
            })}
            
            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm"
              className="ml-2 gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Выход</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
