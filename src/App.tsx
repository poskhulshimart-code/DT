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
  X
} from 'lucide-react';
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
  startOfDay
} from 'date-fns';
import { cn } from './lib/utils';

// --- Types ---

type Priority = 'low' | 'medium' | 'high';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  reminderTime?: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
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
  const [mobileTab, setMobileTab] = useState<'tasks' | 'done' | 'upcoming' | 'stats'>('tasks');

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

  const [activeReminders, setActiveReminders] = useState<Task[]>([]);

  const dateSliderRef = useRef<HTMLDivElement>(null);

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
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pScore = { high: 3, medium: 2, low: 1 };
        if (pScore[b.priority] !== pScore[a.priority]) return pScore[b.priority] - pScore[a.priority];
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [tasks, selectedDate, searchQuery, mobileTab]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdue = tasks.filter(t => !t.completed && isPast(startOfDay(new Date(t.dueDate))) && !isToday(new Date(t.dueDate))).length;
    return { total, completed, percentage, overdue };
  }, [tasks]);

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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };
  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };

  const goToToday = () => {
    const today = startOfToday();
    setSelectedDate(today);
    const todayElement = document.getElementById('today-selector');
    if (todayElement && dateSliderRef.current) {
      todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#FDFCF0] font-sans text-[#2D3436] selection:bg-[#FACC15] selection:text-[#6366F1] overflow-hidden relative">
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
      <header className="lg:hidden bg-[#6366F1] text-white p-4 flex items-center justify-between shadow-lg z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FACC15] rounded-xl flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-[#6366F1]" />
          </div>
          <h1 className="text-xl font-black tracking-tighter italic">DT.</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center font-black text-white text-[10px]">
             {percentageBadge(stats.percentage)}
          </div>
        </div>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-[#6366F1] p-8 flex-col text-white shrink-0">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-[#FACC15] rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <CheckCircle className="h-6 w-6 text-[#6366F1]" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic">DT.</h1>
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
                <span className="text-sm uppercase tracking-widest">Mission History</span>
              </button>
              <button 
                onClick={() => setMobileTab('upcoming')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all",
                  mobileTab === 'upcoming' ? "bg-white/20 text-white font-black" : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                <CalendarIcon className="w-5 h-5" />
                <span className="text-sm uppercase tracking-widest">Upcoming Focus</span>
              </button>
           </nav>

           <div>
              <h3 className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-4">Mantra</h3>
              <div className="bg-white/10 p-6 rounded-[2rem] border border-white/5">
                <p className="text-sm font-bold text-white/80 leading-relaxed italic">
                  "The secret of getting ahead is getting started."
                </p>
              </div>
           </div>

           <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[10px] uppercase font-black tracking-widest text-white/40">Total Efficiency</span>
                <span className="text-2xl font-black text-[#FACC15]">{stats.percentage}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.percentage}%` }}
                  className="h-full bg-[#FACC15]"
                />
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
        mobileTab !== 'tasks' && "hidden lg:flex"
      )}>
        {/* TOP BAR WITH SEARCH AND DATE SELECTION */}
        <header className="p-6 md:p-12 pb-4 md:pb-6 flex flex-col gap-6 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-3">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                  {mobileTab === 'tasks' ? 'Daily Focus' : 
                   mobileTab === 'done' ? 'Mission History' : 
                   mobileTab === 'upcoming' ? 'Upcoming Focus' : 'Statistics'}
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

          {/* DATE SELECTOR SLIDER - Only show in Tasks mode */}
          {mobileTab === 'tasks' && (
            <div className="relative group">
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
              className="flex gap-3 overflow-x-auto pb-4 pt-2 scroll-smooth no-scrollbar"
              style={{ 
                scrollbarWidth: 'none', 
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)'
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
      </header>

        {/* TASK LIST */}
        <section className="flex-1 p-6 md:p-12 pt-0 overflow-y-auto space-y-4 pb-32 lg:pb-12">
          <AnimatePresence>
            {isAddingTask && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border-4 border-[#6366F1] mb-6"
              >
                <form onSubmit={addTask} className="space-y-4">
                  <input 
                    autoFocus
                    placeholder="What needs doing today?"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    className="w-full text-xl md:text-2xl font-black border-none focus:ring-0 p-0 text-slate-900 placeholder:text-slate-200 bg-transparent"
                  />
                  <input 
                    placeholder="Add details (optional)..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    className="w-full text-sm font-medium border-none focus:ring-0 p-0 text-slate-400 placeholder:text-slate-200 bg-transparent"
                  />
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-4 border-t border-slate-50">
                    <div className="flex flex-wrap items-center gap-4">
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Priority:</span>
                          <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                             {(['low', 'medium', 'high'] as Priority[]).map(p => (
                               <button
                                 key={p}
                                 type="button"
                                 onClick={() => setNewTask({...newTask, priority: p})}
                                 className={cn(
                                   "px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                                   newTask.priority === p 
                                     ? p === 'high' ? "bg-rose-500 text-white" : p === 'medium' ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                                     : "text-slate-400 hover:text-slate-600"
                                 )}
                               >
                                 {p}
                               </button>
                             ))}
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Reminder:</span>
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                             <Bell className="w-3.5 h-3.5 text-slate-400" />
                             <input 
                               type="time" 
                               value={newTask.reminderTime}
                               onChange={(e) => setNewTask({...newTask, reminderTime: e.target.value})}
                               className="bg-transparent border-none focus:ring-0 p-0 text-[10px] font-black uppercase text-slate-600 w-20"
                             />
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button type="button" onClick={() => setIsAddingTask(false)} className="px-6 py-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Discard</button>
                       <button type="submit" className="bg-[#6366F1] text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100">Add to {format(selectedDate, 'MMM d')}</button>
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
                    {(mobileTab === 'done' || mobileTab === 'upcoming') && (
                      <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                        • {format(new Date(task.dueDate), 'MMM d')}
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
        </section>
      </main>

      {/* STATS SECTION (Desktop Aside / Mobile Tab) */}
      <aside className={cn(
        "lg:flex w-full lg:w-80 bg-white p-8 md:p-10 flex-col items-center border-l lg:border-slate-50 overflow-y-auto shrink-0",
        mobileTab !== 'stats' && "hidden lg:flex"
      )}>
        <h2 className="lg:hidden text-2xl font-black text-slate-900 mb-10 w-full">Statistics</h2>
        <div className="relative w-48 h-48 mb-12 group">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="96" cy="96" r="84" stroke="#F8FAFC" strokeWidth="18" fill="transparent" />
            <motion.circle 
              cx="96" cy="96" r="84" stroke="#6366F1" strokeWidth="18" fill="transparent"
              strokeDasharray="527.7"
              initial={{ strokeDashoffset: 527.7 }}
              animate={{ strokeDashoffset: 527.7 - (527.7 * stats.percentage) / 100 }}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">{stats.percentage}%</span>
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Efficiency</span>
          </div>
        </div>

        <div className="w-full space-y-10">
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 text-center">
                <span className="text-3xl font-black text-emerald-600 block mb-1">{stats.completed}</span>
                <span className="text-[10px] uppercase font-black text-emerald-700 tracking-widest">Done</span>
             </div>
             <div className="bg-rose-50/50 p-6 rounded-[2rem] border border-rose-100 text-center">
                <span className="text-3xl font-black text-rose-600 block mb-1">{stats.overdue}</span>
                <span className="text-[10px] uppercase font-black text-rose-700 tracking-widest">Lapsed</span>
             </div>
          </div>

          <div>
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lightbulb className="w-3 h-3 text-[#FACC15]" /> Daily Insight
            </h4>
            <div className="bg-[#FDFCF0] p-6 rounded-[2rem] border-2 border-[#FACC15] shadow-sm">
              <p className="text-sm leading-relaxed font-bold text-slate-600 italic">
                "{getInsight(stats.percentage)}"
              </p>
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
            <span className="text-[8px] font-black uppercase tracking-widest">Next</span>
         </button>

         <button 
           onClick={() => setMobileTab('stats')}
           className={cn(
             "px-3 py-4 rounded-3xl flex flex-col items-center gap-1 transition-all",
             mobileTab === 'stats' ? "bg-[#6366F1] text-white shadow-xl shadow-indigo-200" : "text-slate-300"
           )}
         >
            <Layers className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Growth</span>
         </button>
      </footer>
    </div>
  );
}

// --- Utils ---

function percentageBadge(p: number) {
  if (p === 100) return "GOD";
  if (p > 80) return "PRO";
  if (p > 50) return "MED";
  return "STT";
}

function getInsight(p: number) {
  if (p === 100) return "Absolute perfection. Your day is fully conquered.";
  if (p > 80) return "You're in the flow. Keep this momentum going.";
  if (p > 40) return "Focus on the next smallest step to build power.";
  return "Success is the sum of small efforts repeated day in and day out.";
}
