import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon, 
  AlertCircle, 
  Search, 
  Clock, 
  CheckCircle,
  Star,
  Layers,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Bell,
  X,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  MoreVertical,
  Briefcase,
  Archive,
  Upload,
  Loader2,
  FileText,
  Save,
  Trash
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  isPast, 
  isToday, 
  addDays, 
  subDays, 
  eachDayOfInterval, 
  isSameDay, 
  startOfToday,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachMonthOfInterval
} from 'date-fns';
import { cn } from './lib/utils';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---

type Priority = 'low' | 'medium' | 'high';
type SortField = 'priority' | 'dueDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type RosterRole = 'Cashier' | 'Packer' | 'Other' | 'None';

interface RosterAssignment {
  id: string;
  staffName: string;
  role: RosterRole;
  dutyTime: string;
}

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  reminderTime?: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

// --- Mock Data ---

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'Welcome to DT!',
    description: 'A streamlined task manager for your daily goals.',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    priority: 'high',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Morning Yoga',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    priority: 'medium',
    completed: true,
    createdAt: new Date().toISOString(),
  }
];

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dt_data');
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    }
    return INITIAL_TASKS;
  });

  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [mobileTab, setMobileTab] = useState<'tasks' | 'done' | 'upcoming' | 'calendar'>('tasks');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'priority', direction: 'desc' });
  const [dayNotes, setDayNotes] = useState<{[key: string]: string}>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dt_notes');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const [dailyRosters, setDailyRosters] = useState<{[key: string]: RosterAssignment[]}>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dt_rosters_v3');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const [staffMembers, setStaffMembers] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dt_staff');
      return saved ? JSON.parse(saved) : ["Maheen", "HLASINGNUE", "ABDULLAH", "ISTIAK", "RIDAY", "RAMIM", "MUNAEEM", "MISHKAT"];
    }
    return ["Maheen", "HLASINGNUE", "ABDULLAH", "ISTIAK", "RIDAY", "RAMIM", "MUNAEEM", "MISHKAT"];
  });

  const packerStaff = ["SHAHIN", "NABED", "JUMMAN", "RONJON", "RASHED", "FAISAL", "MAMUN", ""];

  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [isMonthlyRosterModalOpen, setIsMonthlyRosterModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleMonthlyRosterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: "Analyze this duty roster image. Extract the month and year if visible. For each person, find their name, role (Cashier, Packer, etc.), and their schedule for each day of the week (SAT, SUN, MON, TUE, WED, THU, FRI). Map the values 'O' to the shift time mentioned in the 'Shift' column (e.g., '07 am - 03 pm' becomes '7-3'), 'OFF' to 'OFF', and 'FULL' to the 'FULL' column time (e.g., '08 am - 08 pm' or '10 am - 10 pm'). Return as JSON." },
            { inlineData: { data: base64Data, mimeType: file.type } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              month: { type: Type.STRING },
              year: { type: Type.NUMBER },
              assignments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING },
                    schedule: {
                      type: Type.OBJECT,
                      properties: {
                        SAT: { type: Type.STRING },
                        SUN: { type: Type.STRING },
                        MON: { type: Type.STRING },
                        TUE: { type: Type.STRING },
                        WED: { type: Type.STRING },
                        THU: { type: Type.STRING },
                        FRI: { type: Type.STRING }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      
      // Map days of week to date keys for the detected month
      const detectedMonth = result.month ? new Date(Date.parse(result.month + " 1, 2026")).getMonth() : 3; 
      const year = result.year || 2026;
      const targetMonth = startOfMonth(new Date(year, detectedMonth));
      const targetEndOfMonth = endOfMonth(targetMonth);
      
      const newRosters = { ...dailyRosters };
      
      eachDayOfInterval({ start: targetMonth, end: targetEndOfMonth }).forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayOfWeek = format(day, 'EEE').toUpperCase(); // SAT, SUN, etc.
        
        const dayAssignments: RosterAssignment[] = [];
        result.assignments.forEach((raw: any) => {
          const shift = raw.schedule[dayOfWeek];
          if (shift && shift !== 'OFF') {
            dayAssignments.push({
              id: Math.random().toString(36).substr(2, 9),
              staffName: raw.name,
              role: (raw.role === 'Cashier' ? 'Cashier' : raw.role === 'Packer' ? 'Packer' : 'Other') as RosterRole,
              dutyTime: shift
            });
          }
        });
        
        if (dayAssignments.length > 0) {
          newRosters[dateKey] = dayAssignments;
        }
      });

      setDailyRosters(newRosters);
      localStorage.setItem('dt_rosters_v3', JSON.stringify(newRosters));
      setIsMonthlyRosterModalOpen(false);
      alert("Monthly roster processed and applied successfully!");
    } catch (err: any) {
      console.error(err);
      setAnalysisError("Failed to analyze roster image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };
  const [activeRosterRole, setActiveRosterRole] = useState<RosterRole | null>(null);

  const dutyTimes = ["7-3", "7-7", "8-8", "10-6", "10-10", "12-8", "2-10", "OFF", "Leave", "CUSTOM"];

  const handleUpdateAssignment = (index: number, field: keyof RosterAssignment, value: string) => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const currentAssignments = dailyRosters[dateKey] || [];
    const updated = [...currentAssignments];
    
    if (index >= updated.length) {
      // Add new assignment if it doesn't exist
      const newAsgn: RosterAssignment = {
        id: Math.random().toString(36).substr(2, 9),
        staffName: field === 'staffName' ? value : '',
        role: activeRosterRole || 'Other',
        dutyTime: field === 'dutyTime' ? value : 'OFF'
      };
      updated.push(newAsgn);
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    const finalRosters = { ...dailyRosters, [dateKey]: updated };
    setDailyRosters(finalRosters);
    localStorage.setItem('dt_rosters_v3', JSON.stringify(finalRosters));
  };

  const [newTask, setNewTask] = useState<{
    title: string;
    description: string;
    priority: Priority;
    reminderTime: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    reminderTime: '',
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLogoMenuOpen, setIsLogoMenuOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date(2026, 3, 1))); // Default to April 2026 as per system time

  const [activeReminders, setActiveReminders] = useState<Task[]>([]);

  const dateSliderRef = useRef<HTMLDivElement>(null);
  const monthSliderRef = useRef<HTMLDivElement>(null);

  // Generate 60 days of dates for slider (30 before, 30 after today)
  const dates = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(startOfToday(), 30),
      end: addDays(startOfToday(), 30),
    });
  }, []);

  // Check for reminders every minute
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const time = format(now, 'HH:mm');

      const triggered = tasks.filter(task => 
        !task.completed && 
        task.dueDate === today && 
        task.reminderTime === time
      );

      if (triggered.length > 0) {
        // Filter out those already active to avoid duplicates
        setActiveReminders(prev => {
          const newReminders = triggered.filter(t => !prev.find(p => p.id === t.id));
          return [...prev, ...newReminders];
        });
      }
    };

    const interval = setInterval(checkReminders, 1000 * 30); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [tasks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dt_data', JSON.stringify(tasks));
    }
  }, [tasks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dt_notes', JSON.stringify(dayNotes));
    }
  }, [dayNotes]);

  // Center active month selector
  useEffect(() => {
    const activeMonthElement = document.getElementById('active-month-selector');
    if (activeMonthElement && monthSliderRef.current) {
      activeMonthElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [viewMonth]);

  // Center today on initial load
  useEffect(() => {
    const todayElement = document.getElementById('today-selector');
    if (todayElement && dateSliderRef.current) {
      todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             task.description?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (mobileTab === 'done') return task.completed;
        if (mobileTab === 'upcoming') {
          return !task.completed && isPast(startOfDay(new Date(task.dueDate))) === false && isToday(new Date(task.dueDate)) === false;
        }
        
        // Default: filter by selectedDate
        return isSameDay(new Date(task.dueDate), selectedDate);
      })
      .sort((a, b) => {
        const direction = sortConfig.direction === 'asc' ? 1 : -1;
        
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        if (sortConfig.field === 'priority') {
          const pScore = { high: 3, medium: 2, low: 1 };
          if (pScore[a.priority] !== pScore[b.priority]) {
            return (pScore[a.priority] - pScore[b.priority]) * direction;
          }
        } else if (sortConfig.field === 'dueDate') {
          const dateA = new Date(a.dueDate).getTime();
          const dateB = new Date(b.dueDate).getTime();
          if (dateA !== dateB) return (dateA - dateB) * direction;
        } else if (sortConfig.field === 'createdAt') {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          if (dateA !== dateB) return (dateA - dateB) * direction;
        }

        // Fallback to secondary sorts for stability
        const pScore = { high: 3, medium: 2, low: 1 };
        if (pScore[b.priority] !== pScore[a.priority]) return pScore[b.priority] - pScore[a.priority];
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [tasks, selectedDate, searchQuery, mobileTab, sortConfig]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    const task: Task = { 
      ...newTask, 
      id: Math.random().toString(36).substring(2, 9), 
      completed: false, 
      dueDate: format(selectedDate, 'yyyy-MM-dd'),
      reminderTime: newTask.reminderTime || undefined,
      createdAt: new Date().toISOString() 
    };
    setTasks([task, ...tasks]);
    setNewTask({ title: '', description: '', priority: 'medium', reminderTime: '' });
    setIsAddingTask(false);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const isNowCompleted = !t.completed;
        return { 
          ...t, 
          completed: isNowCompleted,
          completedAt: isNowCompleted ? new Date().toISOString() : undefined
        };
      }
      return t;
    }));
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };
  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };

  const goToToday = () => {
    const today = startOfToday();
    setSelectedDate(today);
    setViewMonth(startOfMonth(today));
    const todayElement = document.getElementById('today-selector');
    if (todayElement && dateSliderRef.current) {
      todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-[#FDFCF0] font-sans text-[#2D3436] selection:bg-[#FACC15] selection:text-[#6366F1] overflow-hidden relative">
      {/* REMINDER TOASTS */}
      <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-[100] space-y-3">
        <AnimatePresence>
          {activeReminders.map(reminder => (
            <motion.div
              key={reminder.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#6366F1] text-white p-5 rounded-[2rem] shadow-2xl border-4 border-[#FACC15] flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-[#FACC15] rounded-2xl flex items-center justify-center shrink-0 animate-bounce">
                <Bell className="w-6 h-6 text-[#6366F1]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase font-black tracking-widest text-white/60 mb-1">Reminder</p>
                <h4 className="font-black text-lg leading-tight truncate">{reminder.title}</h4>
              </div>
              <button 
                onClick={() => setActiveReminders(prev => prev.filter(r => r.id !== reminder.id))}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MOBILE HEADER */}
      <header className="lg:hidden bg-[#6366F1] text-white p-4 flex items-center justify-between shadow-lg z-30 shrink-0">
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => setIsLogoMenuOpen(!isLogoMenuOpen)}
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 bg-[#FACC15] rounded-xl flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-[#6366F1]" />
            </div>
            <h1 className="text-xl font-black tracking-tighter italic">DT.</h1>
            <MoreVertical className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
          </button>

          <AnimatePresence>
            {isLogoMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl p-2 z-50 border border-slate-100"
              >
                <button 
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    setIsRosterModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-[#6366F1] hover:text-white transition-all"
                >
                  Roaster Daily
                </button>
                <button 
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    setIsMonthlyRosterModalOpen(true);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-[#6366F1] hover:text-white transition-all"
                >
                  Roaster Monthly
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <div className="px-3 py-1 bg-white/20 rounded-xl flex items-center justify-center font-black text-white text-[10px] uppercase tracking-widest">
             {format(selectedDate, 'MMM d')}
          </div>
        </div>
      </header>

      {/* MOBILE SEARCH OVERLAY */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-[#6366F1] px-4 pb-4 z-20 overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input 
                type="text" 
                autoFocus
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border-2 border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20 transition-all"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-[#6366F1] p-8 flex-col text-white shrink-0">
        <div className="flex items-center gap-3 mb-12 relative">
          <button 
            onClick={() => setIsLogoMenuOpen(!isLogoMenuOpen)}
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-[#FACC15] rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <CheckCircle className="h-6 w-6 text-[#6366F1]" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter italic">DT.</h1>
            <MoreVertical className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
          </button>

          <AnimatePresence>
            {isLogoMenuOpen && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                className="absolute top-full left-0 mt-4 w-56 bg-white rounded-[2rem] shadow-2xl p-3 z-50 border border-slate-100"
              >
                <button 
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    setIsRosterModalOpen(true);
                  }}
                  className="w-full text-left px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-[#6366F1] hover:text-white transition-all flex items-center justify-between group"
                >
                  Roaster Daily
                  <div className="w-2 h-2 bg-[#FACC15] rounded-full opacity-0 group-hover:opacity-100" />
                </button>
                <button 
                  onClick={() => {
                    setIsLogoMenuOpen(false);
                    setIsMonthlyRosterModalOpen(true);
                  }}
                  className="w-full text-left px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-[#6366F1] hover:text-white transition-all flex items-center justify-between group"
                >
                  Roaster Monthly
                  <div className="w-2 h-2 bg-[#FACC15] rounded-full opacity-0 group-hover:opacity-100" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 space-y-8">
           <nav className="space-y-2">
              <button 
                onClick={() => setMobileTab('tasks')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                  mobileTab === 'tasks' ? "bg-white/20 text-white font-black" : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <Clock className="w-5 h-5" />
                <span className="text-sm uppercase tracking-widest">Daily Focus</span>
              </button>
              <button 
                onClick={() => setMobileTab('done')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                  mobileTab === 'done' ? "bg-white/20 text-white font-black" : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm uppercase tracking-widest">Done Tasks</span>
              </button>
              <button 
                onClick={() => setMobileTab('calendar')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                  mobileTab === 'calendar' ? "bg-white/20 text-white font-black" : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <CalendarIcon className="w-5 h-5" />
                <span className="text-sm uppercase tracking-widest">Calendar</span>
              </button>
           </nav>

           <div>
              <h3 className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-4">Mantra</h3>
              <div className="bg-white/10 p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                   <Lightbulb className="w-12 h-12 text-white" />
                </div>
                <p className="text-sm font-bold text-white/80 leading-relaxed italic relative z-10">
                   "Success is the sum of small efforts repeated day in and day out."
                </p>
              </div>
           </div>
        </div>

        <div className="mt-auto">
          <button 
            onClick={() => setIsAddingTask(true)}
            className="w-full bg-[#FACC15] text-[#6366F1] py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-yellow-400/20 active:scale-95 transition-transform"
          >
            + New Task
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={cn(
        "flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden transition-all duration-300",
        mobileTab === 'calendar' && "hidden lg:flex"
      )}>
        {/* TOP BAR WITH SEARCH AND TITLE */}
        <header className="p-6 md:p-12 pb-4 md:pb-6 flex flex-col gap-6 shrink-0 z-20">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                  {mobileTab === 'tasks' ? 'Daily Focus' : 
                   mobileTab === 'done' ? 'Done Tasks' : 
                   mobileTab === 'upcoming' ? 'Upcoming' : 'Calendar'}
                </h2>
                {mobileTab === 'tasks' && (
                  <>
                    <span className="text-lg md:text-xl font-black text-[#6366F1] uppercase tracking-tighter opacity-40">
                      {format(selectedDate, 'MMMM')}
                    </span>
                    <button 
                      onClick={goToToday}
                      className="ml-2 px-3 py-1 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#6366F1] hover:bg-[#6366F1] hover:text-white shadow-sm transition-all active:scale-95"
                    >
                      Today
                    </button>
                    {BANGLADESH_HOLIDAYS[format(selectedDate, 'yyyy-MM-dd')] && (
                      <span className="ml-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-xl text-[8px] font-black uppercase tracking-widest text-rose-600 animate-pulse">
                         Public Holiday
                      </span>
                    )}
                    {dailyRosters[format(selectedDate, 'yyyy-MM-dd')] && (dailyRosters[format(selectedDate, 'yyyy-MM-dd')] || []).length > 0 && (
                      <button 
                        onClick={() => setIsRosterModalOpen(true)}
                        className="ml-2 px-3 py-1 bg-[#6366F1]/5 border border-[#6366F1]/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-[#6366F1] hover:bg-indigo-100 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                         <div className="flex -space-x-1">
                            {(dailyRosters[format(selectedDate, 'yyyy-MM-dd')] || []).slice(0, 2).map((a, i) => (
                               <div key={a.id} className={cn("w-1.5 h-1.5 rounded-full border border-white", a.role === 'Cashier' ? "bg-emerald-500" : "bg-blue-500")} />
                            ))}
                         </div>
                         Roster: {(dailyRosters[format(selectedDate, 'yyyy-MM-dd')] || []).length} assigned
                      </button>
                    )}
                    {(!dailyRosters[format(selectedDate, 'yyyy-MM-dd')] || (dailyRosters[format(selectedDate, 'yyyy-MM-dd')] || []).length === 0) && (
                      <button 
                        onClick={() => setIsRosterModalOpen(true)}
                        className="ml-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-[#6366F1] hover:border-indigo-100 transition-all border-dashed"
                      >
                        + Add Roster
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-slate-400 font-medium text-sm">
                {mobileTab === 'tasks' ? 'Organize your thoughts, one day at a time.' :
                 mobileTab === 'done' ? 'A record of your achievements.' :
                 mobileTab === 'upcoming' ? 'Plan ahead for your next big wins.' : 'Your productivity at a glance.'}
              </p>
            </div>
            <div className="relative group hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-[#6366F1]" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border-2 border-transparent focus:border-[#6366F1] rounded-2xl py-2.5 pl-10 pr-4 text-sm w-48 shadow-sm outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sort:</span>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
              {(['priority', 'dueDate', 'createdAt'] as SortField[]).map((field) => (
                <button
                  key={field}
                  onClick={() => setSortConfig(prev => ({ 
                    field, 
                    direction: prev.field === field ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'desc' 
                  }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    sortConfig.field === field ? "bg-[#6366F1] text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {field === 'priority' ? 'Priority' : field === 'dueDate' ? 'Date' : 'Created'}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
              className="px-3 py-1.5 bg-white rounded-xl border border-slate-100 shadow-sm text-[#6366F1] hover:bg-slate-50 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
            >
              {sortConfig.direction === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
              {sortConfig.direction === 'asc' ? 'ASC' : 'DESC'}
            </button>
          </div>
        </header>

        {/* SCROLLABLE TASK LIST & INFO */}
        <section className="flex-1 p-6 md:p-12 pt-0 overflow-y-auto space-y-8 pb-48 lg:pb-12 scroll-smooth min-h-0">
          {/* DATE SELECTOR SLIDER - Inside scroll section */}
          {mobileTab === 'tasks' && (
            <div className="relative group mb-4">
              {/* Scroll Buttons */}
              <button 
                onClick={() => {
                  if (dateSliderRef.current) {
                    dateSliderRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                  }
                }}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 bg-white shadow-xl rounded-full z-20 hidden md:flex items-center justify-center text-slate-400 hover:text-[#6366F1] transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-slate-100"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button 
                onClick={() => {
                  if (dateSliderRef.current) {
                    dateSliderRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                  }
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 bg-white shadow-xl rounded-full z-20 hidden md:flex items-center justify-center text-slate-400 hover:text-[#6366F1] transition-all opacity-0 group-hover:opacity-100 hover:scale-110 border border-slate-100"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <div 
                ref={dateSliderRef}
                className="flex gap-3 overflow-x-auto pb-6 pt-2 scroll-smooth no-scrollbar"
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
                }}
              >
                {dates.map((date) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isTdy = isToday(date);
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dateTasks = tasks.filter(t => t.dueDate === dateStr);
                  const hasTasks = dateTasks.length > 0;
                  const hasIncomplete = dateTasks.some(t => !t.completed);
                  const isFullyDone = hasTasks && !hasIncomplete;

                  return (
                    <button
                      key={date.toISOString()}
                      id={isTdy ? 'today-selector' : undefined}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "shrink-0 w-16 h-20 md:w-20 md:h-24 rounded-3xl flex flex-col items-center justify-center transition-all duration-300 relative border-2",
                        isSelected 
                          ? "bg-[#6366F1] text-white shadow-xl shadow-indigo-200 scale-110 z-10 border-[#6366F1]" 
                          : cn(
                              "bg-white shadow-sm",
                              hasIncomplete 
                                ? "border-rose-500/50 text-rose-400 hover:bg-rose-50/30" 
                                : isFullyDone
                                  ? "border-emerald-500/50 text-emerald-400 hover:bg-emerald-50/30"
                                  : "border-transparent text-slate-400 hover:bg-slate-50"
                            )
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest mb-1", 
                        isSelected 
                          ? "text-white/60" 
                          : hasIncomplete 
                            ? "text-rose-500" 
                            : isFullyDone 
                              ? "text-emerald-500" 
                              : "text-slate-300"
                      )}>
                        {format(date, 'eee')}
                      </span>
                      <span className={cn(
                        "text-xl md:text-2xl font-black",
                        !isSelected && (
                          hasIncomplete 
                            ? "text-rose-600" 
                            : isFullyDone 
                              ? "text-emerald-600" 
                              : ""
                        )
                      )}>
                        {format(date, 'd')}
                      </span>
                      {isSelected && (
                        <motion.div 
                          layoutId="active-indicator"
                          className="absolute -bottom-1 w-2 h-2 bg-[#FACC15] rounded-full shadow-lg shadow-yellow-400/50"
                        />
                      )}
                      {!isSelected && hasIncomplete && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                      )}
                      {!isSelected && isFullyDone && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <AnimatePresence>
            {isMonthlyRosterModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-white w-full max-w-xl rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6">
                     <button onClick={() => setIsMonthlyRosterModalOpen(false)} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                        <X className="w-6 h-6 text-slate-400" />
                     </button>
                  </div>

                  <div className="mb-10 flex items-center gap-4">
                     <div className="w-16 h-16 bg-[#FACC15] rounded-3xl flex items-center justify-center shadow-2xl shadow-yellow-200">
                        <CalendarIcon className="w-8 h-8 text-[#6366F1]" />
                     </div>
                     <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Monthly Roster</h2>
                        <p className="text-[10px] uppercase font-black tracking-widest text-[#6366F1]">Upload image to auto-populate</p>
                     </div>
                  </div>

                  <div className="space-y-8">
                     <div className="p-10 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-center gap-6 group hover:border-[#6366F1] hover:bg-indigo-50/30 transition-all relative">
                        {isAnalyzing ? (
                          <div className="flex flex-col items-center gap-4">
                             <Loader2 className="w-12 h-12 text-[#6366F1] animate-spin" />
                             <p className="text-xs font-black uppercase text-[#6366F1] tracking-widest">Gemini is analyzing your roster...</p>
                          </div>
                        ) : (
                          <>
                            <div className="w-20 h-20 bg-white rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-indigo-100 group-hover:scale-110 transition-transform">
                               <Upload className="w-10 h-10 text-[#6366F1]" />
                            </div>
                            <div>
                               <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Upload Roster Image</h3>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">JPEG or PNG Format. Gemini AI will handle the rest.</p>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleMonthlyRosterFileUpload}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </>
                        )}
                     </div>

                     {analysisError && (
                       <div className="bg-rose-50 p-6 rounded-3xl border-2 border-rose-100 flex gap-4 items-center">
                          <AlertCircle className="w-6 h-6 text-rose-500 shrink-0" />
                          <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest leading-relaxed">{analysisError}</p>
                       </div>
                     )}

                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                           <h4 className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">Supported Formats</h4>
                           <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#6366F1]" />
                              <span className="text-[10px] font-black text-slate-900">JPEG, PNG, WEBP</span>
                           </div>
                        </div>
                        <div className="bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-100">
                           <h4 className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-2">AI Precision</h4>
                           <div className="flex items-center gap-2">
                              <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
                              <span className="text-[10px] font-black text-emerald-900">99.9% Accuracy</span>
                           </div>
                        </div>
                     </div>

                     <button 
                       onClick={() => setIsMonthlyRosterModalOpen(false)}
                       className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl active:scale-[0.98] transition-all"
                     >
                       Cancel
                     </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {isRosterModalOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-white w-full max-w-2xl rounded-[3rem] p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                >
                  <div className="absolute top-0 right-0 p-6 z-10">
                     <button onClick={() => {
                        setIsRosterModalOpen(false);
                        setActiveRosterRole(null);
                     }} className="p-3 hover:bg-slate-50 rounded-2xl transition-all">
                        <X className="w-6 h-6 text-slate-400" />
                     </button>
                  </div>

                  {!activeRosterRole ? (
                    <div className="space-y-8 py-4">
                       <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-[#6366F1] rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200">
                             <CalendarIcon className="w-8 h-8 text-white" />
                          </div>
                          <div>
                             <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">Daily Roster</h2>
                             <p className="text-[10px] uppercase font-black tracking-widest text-[#6366F1]">Select role to manage schedule</p>
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(['Cashier', 'Packer', 'Other'] as RosterRole[]).map(role => (
                             <button
                                key={role}
                                onClick={() => setActiveRosterRole(role)}
                                className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 hover:border-[#6366F1] hover:bg-white transition-all flex flex-col items-center gap-4 group"
                             >
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-[#6366F1] group-hover:text-white transition-all text-slate-400">
                                   {role === 'Cashier' ? <Briefcase className="w-7 h-7" /> : role === 'Packer' ? <Archive className="w-7 h-7" /> : <MoreVertical className="w-7 h-7" />}
                                </div>
                                <span className="font-black text-slate-900 uppercase tracking-widest text-sm">{role}</span>
                             </button>
                          ))}
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0">
                       <div className="mb-6 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <button onClick={() => setActiveRosterRole(null)} className="p-2 hover:bg-slate-50 rounded-xl">
                                <ChevronLeft className="w-5 h-5 text-slate-400" />
                             </button>
                             <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{activeRosterRole} SCHEDULE</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(selectedDate, 'EEEE, d MMMM yyyy')}</p>
                             </div>
                          </div>
                       </div>

                       {/* TABLE VIEW */}
                       <div className={cn(
                         "flex-1 overflow-y-auto no-scrollbar border-[1.5px] md:border-2 border-slate-900 rounded-xl overflow-hidden",
                         activeRosterRole === 'Packer' ? "bg-[#FFFF00] p-2 md:p-3" : "bg-white"
                       )}>
                          <div className={cn(
                            "w-full h-full",
                            activeRosterRole === 'Packer' && "border-[1.5px] md:border-2 border-green-800 bg-white"
                          )}>
                            <table className="w-full border-collapse">
                               <thead>
                                  <tr className="bg-white border-b-[1.5px] md:border-b-2 border-slate-900">
                                     <th className="p-3 md:p-4 text-left text-[10px] md:text-xs font-black uppercase tracking-widest border-r-[1.5px] md:border-r-2 border-slate-900 w-1/2">Name</th>
                                     <th className="p-3 md:p-4 text-left text-[10px] md:text-xs font-black uppercase tracking-widest">Duty Time</th>
                                  </tr>
                               </thead>
                               <tbody>
                                  {Array.from({ length: 8 }).map((_, idx) => {
                                     const dateKey = format(selectedDate, 'yyyy-MM-dd');
                                     const currentAssignments = dailyRosters[dateKey] || [];
                                     const roleAssignments = currentAssignments.filter(a => a.role === activeRosterRole);
                                     const assignment = roleAssignments[idx];
                                     
                                     const defaultPlaceholder = activeRosterRole === 'Packer' 
                                      ? (idx < packerStaff.length ? packerStaff[idx] : "")
                                      : (idx < staffMembers.length ? staffMembers[idx] : "");

                                     return (
                                        <tr key={idx} className="border-b-[1.5px] md:border-b-2 border-slate-900 last:border-b-0 hover:bg-slate-50 transition-colors">
                                           <td className={cn(
                                             "p-0 border-r-[1.5px] md:border-r-2 border-slate-900",
                                             activeRosterRole === 'Packer' && "bg-gray-300"
                                           )}>
                                              <input 
                                                type="text" 
                                                placeholder={defaultPlaceholder || "Enter..."}
                                                value={assignment?.staffName || ""}
                                                onChange={(e) => {
                                                  const updatedAll = [...currentAssignments];
                                                  const existingIdxInTotal = updatedAll.indexOf(assignment!);
                                                  
                                                  if (existingIdxInTotal === -1) {
                                                     updatedAll.push({
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        staffName: e.target.value,
                                                        role: activeRosterRole!,
                                                        dutyTime: "OFF"
                                                     });
                                                  } else {
                                                     updatedAll[existingIdxInTotal].staffName = e.target.value;
                                                  }
                                                  setDailyRosters({ ...dailyRosters, [dateKey]: updatedAll });
                                                  localStorage.setItem('dt_rosters_v3', JSON.stringify({ ...dailyRosters, [dateKey]: updatedAll }));
                                                }}
                                                className="w-full p-3 md:p-4 text-xs md:text-sm font-black text-slate-900 bg-transparent outline-none uppercase placeholder:text-slate-500"
                                              />
                                           </td>
                                           <td className={cn(
                                             "p-0",
                                             activeRosterRole === 'Packer' ? "bg-gray-300" : "bg-slate-200"
                                           )}>
                                              <select 
                                                value={assignment?.dutyTime || "OFF"}
                                                onChange={(e) => {
                                                  const updatedAll = [...currentAssignments];
                                                  const existingIdxInTotal = updatedAll.indexOf(assignment!);
                                                  
                                                  if (existingIdxInTotal === -1) {
                                                     updatedAll.push({
                                                        id: Math.random().toString(36).substr(2, 9),
                                                        staffName: assignment?.staffName || (activeRosterRole === 'Packer' ? (packerStaff[idx] || "") : (staffMembers[idx] || "")),
                                                        role: activeRosterRole!,
                                                        dutyTime: e.target.value
                                                     });
                                                  } else {
                                                     updatedAll[existingIdxInTotal].dutyTime = e.target.value;
                                                  }
                                                  setDailyRosters({ ...dailyRosters, [dateKey]: updatedAll });
                                                  localStorage.setItem('dt_rosters_v3', JSON.stringify({ ...dailyRosters, [dateKey]: updatedAll }));
                                                }}
                                                className="w-full p-3 md:p-4 text-[10px] md:text-xs font-black text-slate-900 bg-transparent outline-none uppercase cursor-pointer"
                                              >
                                                 {dutyTimes.map(time => (
                                                    <option key={time} value={time}>{time}</option>
                                                 ))}
                                              </select>
                                           </td>
                                        </tr>
                                     );
                                  })}
                               </tbody>
                            </table>
                          </div>
                       </div>

                       <div className="mt-6 md:mt-8 flex gap-4">
                          <button 
                             onClick={() => {
                                setIsRosterModalOpen(false);
                                setActiveRosterRole(null);
                             }}
                             className="flex-1 bg-[#6366F1] text-white py-4 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl shadow-indigo-200 active:scale-[0.98] transition-all"
                          >
                             Save Schedule
                          </button>
                       </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}

            {isAddingTask && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className={cn(
                  "fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-slate-900/60 backdrop-blur-sm lg:relative lg:inset-auto lg:z-0 lg:p-0 lg:bg-transparent lg:backdrop-blur-none"
                )}
              >
                {/* Click outside to close for mobile overlay */}
                <div className="absolute inset-0 lg:hidden" onClick={() => setIsAddingTask(false)} />
                
                <form 
                  onSubmit={addTask}
                  className="bg-white w-full lg:w-auto lg:flex-1 p-8 md:p-10 rounded-t-[3rem] md:rounded-[3rem] border-x md:border-2 border-t md:border-slate-100 shadow-2xl lg:shadow-none relative z-10 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-8">
                     <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FACC15] rounded-2xl flex items-center justify-center">
                           <Plus className="w-6 h-6 text-[#6366F1]" />
                        </div>
                        Set New Focus
                     </h2>
                     <button type="button" onClick={() => setIsAddingTask(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                     </button>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="What's your priority?"
                        value={newTask.title}
                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                        className="w-full text-2xl font-black text-slate-900 placeholder:text-slate-200 outline-none border-b-4 border-slate-50 focus:border-[#6366F1] pb-2 transition-all bg-transparent"
                      />
                      <textarea 
                        placeholder="Add some details..."
                        value={newTask.description}
                        onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                        className="w-full text-sm font-bold text-slate-500 placeholder:text-slate-200 outline-none border-none resize-none h-20 bg-transparent"
                      />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Priority:</span>
                           <div className="flex gap-2">
                              {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                                <button 
                                  key={p}
                                  type="button"
                                  onClick={() => setNewTask({...newTask, priority: p})}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                                    newTask.priority === p 
                                      ? p === 'high' ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-100" : p === 'medium' ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100" : "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-100"
                                      : "text-slate-400 hover:text-slate-600 border-slate-50 bg-slate-50"
                                  )}
                                >
                                  {p}
                                </button>
                              ))}
                           </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Reminder:</span>
                           <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-100">
                              <Bell className="w-4 h-4 text-slate-400" />
                              <input 
                                type="time" 
                                value={newTask.reminderTime}
                                onChange={(e) => setNewTask({...newTask, reminderTime: e.target.value})}
                                className="bg-transparent border-none focus:ring-0 p-0 text-xs font-black uppercase text-slate-600 w-24"
                              />
                           </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                       <button type="button" onClick={() => setIsAddingTask(false)} className="px-6 py-4 flex-1 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Discard</button>
                       <button type="submit" className="bg-[#6366F1] text-white px-8 py-4 flex-[2] rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">Add Focus</button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout text-left">
            {filteredTasks.length > 0 ? filteredTasks.map((task) => (
              <motion.div
                layout
                key={task.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={cn(
                  "group bg-white p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-sm border-4 border-transparent hover:border-[#6366F1]/10 flex items-center gap-4 md:gap-6 cursor-pointer transition-all",
                  task.completed && "opacity-60 bg-slate-50/50"
                )}
                onClick={() => toggleTask(task.id)}
              >
                <div className={cn(
                  "w-8 h-8 rounded-2xl border-[3px] flex items-center justify-center shrink-0 transition-all",
                  task.completed ? "bg-[#6366F1] border-[#6366F1]" : "border-slate-100 bg-slate-50"
                )}>
                  {task.completed && <CheckCircle className="w-5 h-5 text-white stroke-[4px]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={cn("text-lg font-black text-slate-800 leading-tight", task.completed && "text-slate-400 line-through")}>
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={cn(
                      "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest leading-none",
                      task.priority === 'high' ? "text-rose-500" : task.priority === 'medium' ? "text-amber-500" : "text-blue-500"
                    )}>
                      {task.priority} Focus
                    </span>
                    <span className={cn(
                      "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest leading-none px-2 py-1 rounded-lg",
                      task.completed ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                    )}>
                      {task.completed ? "Done" : "Pending"}
                    </span>
                    {task.description && (
                      <span className="text-[10px] text-slate-300 font-bold max-w-[200px] truncate">
                        • {task.description}
                      </span>
                    )}
                    {task.reminderTime && (
                      <span className={cn(
                        "flex items-center gap-1 text-[10px] font-black uppercase tracking-widest",
                        task.completed ? "text-slate-300" : "text-[#6366F1]"
                      )}>
                        • <Bell className="w-3 h-3" /> {task.reminderTime}
                      </span>
                    )}
                    {mobileTab === 'done' && task.completedAt && (
                      <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                        • Done {format(new Date(task.completedAt), 'MMM d, h:mm a')}
                      </span>
                    )}
                    {mobileTab === 'upcoming' && (
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        • Due {format(new Date(task.dueDate), 'MMM d')} {task.reminderTime ? `@ ${task.reminderTime}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                  className="p-3 text-slate-100 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            )) : (
              <div className="py-24 text-center space-y-6">
                <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto shadow-sm border-2 border-slate-50">
                   <Star className="w-8 h-8 text-[#FACC15]" fill="#FACC15" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">All Quiet for {format(selectedDate, 'MMM d')}.</h3>
                  <p className="text-slate-400 font-medium text-sm">Ready to plan your next priority?</p>
                </div>
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="bg-white border-2 border-[#6366F1] text-[#6366F1] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#6366F1] hover:text-white transition-all shadow-sm"
                >
                  Set a Focus
                </button>
              </div>
            )}
          </AnimatePresence>

          {/* DAY NOTES - Also visible in Task Focus View */}
          <div className="mt-12 pt-12 border-t-2 border-slate-100/50 space-y-6">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Lightbulb className="w-3 h-3 text-[#FACC15]" /> Daily Reflection & Notes
            </h3>
            <textarea 
              value={dayNotes[format(selectedDate, 'yyyy-MM-dd')] || ''}
              onChange={(e) => setDayNotes({...dayNotes, [format(selectedDate, 'yyyy-MM-dd')]: e.target.value})}
              placeholder={`Write down thoughts for ${format(selectedDate, 'MMMM d')}...`}
              className="w-full min-h-[150px] bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 text-sm font-bold text-slate-600 placeholder:text-slate-300 focus:border-[#FACC15] outline-none transition-all resize-none shadow-sm"
            />
          </div>
        </section>
      </main>

      {/* CALENDAR SECTION (Desktop Aside / Mobile Tab) */}
      <aside className={cn(
        "lg:flex w-full lg:w-[450px] bg-white flex-col border-l lg:border-slate-50 overflow-hidden shrink-0 flex-1 lg:flex-none h-full min-h-0",
        mobileTab !== 'calendar' && "hidden lg:flex"
      )}>
        <div className="p-8 md:p-10 pb-0 w-full flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
             <CalendarIcon className="w-8 h-8 text-[#6366F1]" />
             Calendar
          </h2>
          <button 
            onClick={goToToday}
            className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#6366F1] hover:bg-[#6366F1] hover:text-white shadow-sm transition-all shadow-inner"
          >
            Today
          </button>
        </div>

        {/* CALENDAR SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-8 md:p-10 pt-6 space-y-12 scroll-smooth min-h-0">
          {/* MONTH SELECTOR - Now inside scroll area */}
          <div className="relative group mb-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (monthSliderRef.current) {
                  monthSliderRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                }
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-8 h-8 bg-white shadow-lg rounded-full z-20 hidden md:flex items-center justify-center text-slate-400 hover:text-[#6366F1] transition-all opacity-0 group-hover:opacity-100 border border-slate-100"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                if (monthSliderRef.current) {
                  monthSliderRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                }
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 bg-white shadow-lg rounded-full z-20 hidden md:flex items-center justify-center text-slate-400 hover:text-[#6366F1] transition-all opacity-0 group-hover:opacity-100 border border-slate-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div 
              ref={monthSliderRef}
              className="flex gap-2 overflow-x-auto no-scrollbar pb-6 scroll-smooth"
              style={{ 
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
              }}
            >
              {eachMonthOfInterval({
                start: startOfYear(new Date(2026, 0, 1)),
                end: endOfYear(new Date(2026, 0, 1))
              }).map((m) => {
                const isCurrent = isSameDay(startOfMonth(m), viewMonth);
                return (
                  <button
                    key={m.toISOString()}
                    id={isCurrent ? 'active-month-selector' : undefined}
                    onClick={() => setViewMonth(startOfMonth(m))}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      isCurrent ? "bg-[#6366F1] text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {format(m, 'MMM')}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-6">
                <h3 className="font-black text-[#6366F1] uppercase tracking-widest text-sm px-2 flex justify-between items-center">
                  {format(viewMonth, 'MMMM yyyy')}
                </h3>

                <div className="grid grid-cols-7 gap-2">
                   {['S','M','T','W','T','F','S'].map((d, i) => (
                     <span key={i} className="text-[10px] font-black text-slate-200 text-center uppercase mb-2">{d}</span>
                   ))}
                   
                   {/* Spacing for start of month */}
                   {Array.from({length: parseInt(format(startOfMonth(viewMonth), 'i')) % 7}).map((_, i) => (
                     <div key={`empty-${i}`} />
                   ))}

                   {eachDayOfInterval({
                     start: startOfMonth(viewMonth),
                     end: endOfMonth(viewMonth)
                   }).map((day) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const isSelected = isSameDay(day, selectedDate);
                      const holiday = BANGLADESH_HOLIDAYS[dateKey];
                      const isTodayDate = isToday(day);

                      return (
                        <button 
                          key={day.toISOString()}
                          onClick={() => {
                            setSelectedDate(day);
                            setViewMonth(startOfMonth(day));
                          }}
                          className={cn(
                            "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all group",
                            isSelected ? "bg-[#6366F1] text-white shadow-lg shadow-indigo-200 scale-110 z-10" : "bg-slate-50/50 border border-transparent hover:border-indigo-100 hover:bg-indigo-50/30",
                            holiday && !isSelected && "bg-rose-50 border-rose-200",
                            isTodayDate && !isSelected && "ring-2 ring-[#FACC15] ring-offset-2"
                          )}
                        >
                           <span className={cn(
                             "text-xs font-black",
                             holiday && !isSelected ? "text-rose-600" : "text-slate-600",
                             isSelected && "text-white"
                           )}>
                             {format(day, 'd')}
                           </span>
                           {holiday && (
                             <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 border-2 border-white rounded-full shadow-sm" />
                           )}
                           {dailyRosters[dateKey] && (dailyRosters[dateKey] || []).length > 0 && (
                             <div className="absolute top-1 left-1 flex items-center justify-center">
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  (dailyRosters[dateKey] || []).some(a => a.role === 'Cashier') ? "bg-emerald-500" : "bg-blue-500"
                                )} />
                             </div>
                           )}
                           {dayNotes[dateKey] && !isSelected && (
                             <div className="absolute -bottom-1 w-1.5 h-1.5 bg-[#FACC15] rounded-full" />
                           )}
                        </button>
                      );
                   })}
                </div>
             </div>

           {/* DAY DETAILS & NOTES FIXED BOTTOM STYLE WITHIN SCROLL */}
           <div className="pt-12 border-t-2 border-slate-50 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{format(selectedDate, 'EEEE')}</p>
                  <h4 className="text-2xl font-black text-slate-900">{format(selectedDate, 'MMMM d, yyyy')}</h4>
                </div>
                {BANGLADESH_HOLIDAYS[format(selectedDate, 'yyyy-MM-dd')] && (
                  <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl border border-rose-100 flex items-center gap-2">
                     <Star className="w-4 h-4 fill-rose-600" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Public Holiday</span>
                  </div>
                )}
              </div>

              {BANGLADESH_HOLIDAYS[format(selectedDate, 'yyyy-MM-dd')] && (
                <div className="bg-rose-50/50 p-6 rounded-[2.5rem] border-2 border-rose-100 flex gap-4 items-center">
                   <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-200">
                      <AlertCircle className="w-6 h-6 text-white" />
                   </div>
                   <div>
                      <h5 className="font-black text-rose-900 leading-tight mb-1">
                         {BANGLADESH_HOLIDAYS[format(selectedDate, 'yyyy-MM-dd')]}
                      </h5>
                      <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Bangladesh Govt. Holiday</p>
                   </div>
                </div>
              )}

              <div className="flex flex-col gap-4 pb-48 lg:pb-0">
                 <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                   <Lightbulb className="w-3 h-3 text-[#FACC15]" /> Today's Notes
                 </h5>
                 <textarea 
                   value={dayNotes[format(selectedDate, 'yyyy-MM-dd')] || ''}
                   onChange={(e) => setDayNotes({...dayNotes, [format(selectedDate, 'yyyy-MM-dd')]: e.target.value})}
                   placeholder={`What's happening on ${format(selectedDate, 'MMMM d')}? Write something about the day...`}
                   className="w-full min-h-[200px] bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-8 text-sm font-bold text-slate-600 placeholder:text-slate-300 focus:border-[#FACC15] outline-none transition-all resize-none shadow-inner"
                 />
              </div>
           </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <footer className="lg:hidden fixed bottom-6 left-6 right-6 flex justify-between items-center z-40 bg-white/90 backdrop-blur-xl border border-white p-2 rounded-[2.5rem] shadow-2xl">
         <button 
           onClick={() => setMobileTab('tasks')}
           className={cn(
             "px-3 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all",
             mobileTab === 'tasks' ? "bg-[#6366F1] text-white shadow-xl shadow-indigo-200" : "text-slate-300"
           )}
         >
            <Clock className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Focus</span>
         </button>

         <button 
           onClick={() => setMobileTab('done')}
           className={cn(
             "px-3 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all",
             mobileTab === 'done' ? "bg-[#6366F1] text-white shadow-xl shadow-indigo-200" : "text-slate-300"
           )}
         >
            <CheckCircle className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Done</span>
         </button>
         
         <div className="px-2">
            <button 
              onClick={() => setIsAddingTask(true)}
              className="w-14 h-14 bg-[#FACC15] text-[#6366F1] rounded-2xl flex items-center justify-center shadow-xl shadow-yellow-500/20 active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6 stroke-[4px]" />
            </button>
         </div>

         <button 
           onClick={() => setMobileTab('upcoming')}
           className={cn(
             "px-3 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all",
             mobileTab === 'upcoming' ? "bg-[#6366F1] text-white shadow-xl shadow-indigo-200" : "text-slate-300"
           )}
         >
            <CalendarIcon className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Upcoming</span>
         </button>

         <button 
           onClick={() => setMobileTab('calendar')}
           className={cn(
             "px-3 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all",
             mobileTab === 'calendar' ? "bg-[#6366F1] text-white shadow-xl shadow-indigo-200" : "text-slate-300"
           )}
         >
            <CalendarIcon className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Dates</span>
         </button>
      </footer>
    </div>
  );
}

// --- Constants ---

const BANGLADESH_HOLIDAYS: {[key: string]: string} = {
  '2026-02-21': 'Shaheed Day & International Mother Language Day',
  '2026-03-17': "Sheikh Mujibur Rahman's Birthday",
  '2026-03-20': 'Eid-ul-Fitr (Estimated)',
  '2026-03-21': 'Eid-ul-Fitr Holiday (Estimated)',
  '2026-03-22': 'Eid-ul-Fitr Holiday (Estimated)',
  '2026-03-26': 'Independence Day',
  '2026-04-14': 'Pahela Baishakh (Bengali New Year)',
  '2026-05-01': 'May Day / Buddha Purnima',
  '2026-05-27': 'Eid-ul-Adha (Estimated)',
  '2026-05-28': 'Eid-ul-Adha Holiday (Estimated)',
  '2026-05-29': 'Eid-ul-Adha Holiday (Estimated)',
  '2026-07-26': 'Ashura (Estimated)',
  '2026-10-20': 'Durga Puja (Dashami)',
  '2026-12-16': 'Victory Day',
  '2026-12-25': 'Christmas Day'
};

// --- Utils ---

// No utils currently needed.
