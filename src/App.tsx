import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  Timestamp, 
  orderBy, 
  limit, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage, signInWithGoogle, logout } from "./services/firebase";
import { useAuthStore } from "./store/authStore";
import AuthProvider from "./AuthProvider";
import Layout from "./components/layout/Layout";
import { Loader2, Plus, Calendar, MapPin, Users, Heart, ArrowRight, Sparkles, ChevronRight, Bell, Tv, Radio, User, Mail, Phone, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import { toast, Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from 'qrcode.react';

// --- Types ---
interface ChurchEvent {
  id: string;
  title: string;
  category: string;
  description: string;
  date: any;
  location: string;
  venueType: string;
  speaker: string;
  creatorId: string;
  bannerUrl: string;
  status: string;
  createdAt: any;
  isEndorsed?: boolean;
}

interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'attendee' | 'visionary' | 'admin';
  accountType: 'individual' | 'organization';
  preferredLanguage: string;
  verificationStatus: 'none' | 'pending' | 'verified' | 'requires_doc';
  walletBalance: number;
  subscriptionStatus: 'active' | 'inactive';
  subscriptionExpiry?: any;
  churchName?: string;
  onboarded: boolean;
  endorsedBy?: string;
  endorsedByTitle?: string;
  endorsedUsers?: string[];
}

interface Registration {
  id: string;
  eventId: string;
  userId: string;
  ticketCode: string;
  status: 'Registered' | 'Checked-in' | 'Cancelled';
  registrationDate: any;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  volunteerRole?: string;
}

type Screen = 'dashboard' | 'events' | 'create' | 'live' | 'notifications' | 'event-details' | 'welcome' | 'analytics' | 'donations' | 'ai-planner' | 'community' | 'settings' | 'onboarding' | 'stream-player' | 'profile' | 'register-form' | 'go-live' | 'attendee-management';

interface StreamSession {
  id: string;
  title: string;
  description: string;
  organizationId: string;
  thumbnailUrl: string;
  status: 'scheduled' | 'live' | 'ended';
  viewers: number;
  startedAt: any;
  isPremium?: boolean;
  translations?: Record<string, string>;
  aiSummary?: string;
}

const BROADCAST_LANGUAGES = [
  { code: 'en', label: 'English', region: 'Global', flag: '🇬🇧', type: 'international' },
  { code: 'fr', label: 'French', region: 'Global', flag: '🇫🇷', type: 'international' },
  { code: 'es', label: 'Spanish', region: 'Global', flag: '🇪🇸', type: 'international' },
  { code: 'ha', label: 'Hausa', region: 'Nigeria/W.Africa', flag: '🇳🇬', type: 'local' },
  { code: 'yo', label: 'Yoruba', region: 'Nigeria/Benin', flag: '🇳🇬', type: 'local' },
  { code: 'ig', label: 'Igbo', region: 'Nigeria', flag: '🇳🇬', type: 'local' },
  { code: 'pi', label: 'Pidgin', region: 'W.Africa', flag: '🇳🇬', type: 'local' },
];

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  );
}

function NavHeader({ onSearch }: { onSearch?: (q: string) => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-4 pointer-events-none">
      <div className="max-w-[440px] mx-auto pointer-events-auto">
        <div className="bg-white/80 backdrop-blur-xl border border-blue-50 shadow-lg shadow-blue-900/5 rounded-3xl h-14 flex items-center px-4 gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
          <div className="p-2 bg-blue-50 rounded-xl">
             <Sparkles size={14} className="text-blue-600" />
          </div>
          <div className="flex-1 flex items-center bg-slate-50 rounded-xl px-3 h-10 border border-slate-100/50">
             <Input 
                className="border-none bg-transparent h-full p-0 text-[10px] font-bold uppercase tracking-tight placeholder:text-slate-300 focus-visible:ring-0" 
                placeholder="Search Kingdom Network..." 
                onChange={(e) => onSearch?.(e.target.value)}
             />
          </div>
          <Avatar className="h-8 w-8 border border-white shrink-0">
             <AvatarImage src={auth.currentUser?.photoURL || ""} />
             <AvatarFallback className="bg-blue-600 text-white text-[9px] font-black">{auth.currentUser?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  );
}

function MainContent() {
  const { user, loading } = useAuthStore();
  const [activeScreen, setActiveScreen] = useState<Screen>('welcome');
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRegistrations, setUserRegistrations] = useState<Registration[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamSession | null>(null);

  useEffect(() => {
    if (!loading && user) {
      fetchProfile();
      checkAdminStatus();
      fetchEvents();
      fetchUserRegistrations();
      fetchStreams();
    } else if (!loading && !user) {
      setActiveScreen('welcome');
    }
  }, [user, loading]);

  const fetchStreams = async () => {
    try {
      const q = query(collection(db, "streams"), orderBy("status", "desc"), limit(10));
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StreamSession[];
      
      if (fetched.length === 0) {
        // Dummy data for simulation
        setStreams([
          {
            id: 'demo-1',
            title: 'Global Outreach Crusade: Lagos',
            description: 'Live broadcast of the regional prophetic gathering in Lagos, Nigeria.',
            status: 'live',
            organizationId: 'org-1',
            thumbnailUrl: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?auto=format&fit=crop&q=80&w=800',
            viewers: 12450,
            startedAt: Timestamp.now(),
          },
          {
            id: 'demo-2',
            title: 'Prophetic Intelligence Briefing',
            description: 'Understanding divine directives for the next economic quarter.',
            status: 'live',
            isPremium: true,
            organizationId: 'org-2',
            thumbnailUrl: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?auto=format&fit=crop&q=80&w=800',
            viewers: 0,
            startedAt: Timestamp.now(),
          }
        ]);
      } else {
        setStreams(fetched);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setProfile(data);
        if (!data.onboarded) {
          setActiveScreen('onboarding');
        }
      } else {
        // Create initial profile
        const newProfile: UserProfile = {
          userId: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Holy Citizen',
          photoURL: user.photoURL || '',
          role: 'attendee',
          accountType: 'individual',
          preferredLanguage: 'en',
          verificationStatus: 'none',
          walletBalance: 1000, // Welcome gift in ESP
          subscriptionStatus: 'inactive',
          onboarded: false,
        };
        await setDoc(doc(db, 'users', user.uid), newProfile);
        setProfile(newProfile);
        setActiveScreen('onboarding');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    try {
      // First check official admin collection
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        setIsAdmin(true);
        return;
      }
      
      // Then check user profile for Visionary/Admin roles
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setIsAdmin(data.role === 'visionary' || data.role === 'admin' || data.isAdmin === true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvents = async () => {
    try {
      const q = query(collection(db, "events"), orderBy("date", "desc"), limit(20));
      const querySnapshot = await getDocs(q);
      setEvents(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ChurchEvent[]);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUserRegistrations = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "registrations"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      setUserRegistrations(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Registration[]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegister = async (event: ChurchEvent, formData?: { name: string; email: string; phone: string }) => {
    if (!user) return toast.error("Please login first");
    const ticketCode = `KC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    try {
      await addDoc(collection(db, "registrations"), {
        eventId: event.id,
        userId: user.uid,
        ticketCode,
        status: 'Registered',
        registrationDate: Timestamp.now(),
        attendeeName: formData?.name || user.displayName,
        attendeeEmail: formData?.email || user.email,
        attendeePhone: formData?.phone || '',
      });
      toast.success("Successfully registered!");
      fetchUserRegistrations();
      setActiveScreen('event-details');
    } catch (e) {
      toast.error("Registration failed");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {activeScreen === 'welcome' && (
        <ScreenWrapper key="welcome">
          <WelcomeScreen 
            isLoggedIn={!!user} 
            onLogin={signInWithGoogle} 
            onContinue={() => {
              if (profile?.churchName) {
                setActiveScreen('dashboard');
              } else {
                setActiveScreen('onboarding');
              }
            }}
          />
        </ScreenWrapper>
      )}

      {activeScreen !== 'welcome' && (
        <div className="pt-20">
          <NavHeader onSearch={setSearchQuery} />
          <Layout 
            activeScreen={activeScreen as any} 
            setActiveScreen={setActiveScreen as any}
            isAdmin={isAdmin}
          >
            {activeScreen === 'dashboard' && (
              <Dashboard 
                user={user} 
                profile={profile}
                events={events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onEventClick={(e: ChurchEvent) => { setSelectedEvent(e); setActiveScreen('event-details'); }} 
                onActionClick={(screen: Screen) => setActiveScreen(screen)}
              />
            )}
            {activeScreen === 'events' && (
              <EventList 
                events={events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onEventClick={(e: ChurchEvent) => { setSelectedEvent(e); setActiveScreen('event-details'); }} 
              />
            )}
            {activeScreen === 'create' && <CreateEventScreen onCreated={() => { fetchEvents(); setActiveScreen('events'); }} />}
            {activeScreen === 'profile' && <ProfileScreen user={user} profile={profile} registrations={userRegistrations} events={events} onLogout={logout} onNavigate={setActiveScreen} />}
            {activeScreen === 'event-details' && selectedEvent && (
              <EventDetails 
                event={selectedEvent} 
                profile={profile}
                isRegistered={userRegistrations.some(r => r.eventId === selectedEvent.id)}
                onRegister={() => setActiveScreen('register-form')}
                onManageAttendees={() => setActiveScreen('attendee-management')}
                onBack={() => setActiveScreen('dashboard')} 
              />
            )}
            {activeScreen === 'register-form' && selectedEvent && (
              <EventRegistrationScreen 
                event={selectedEvent}
                onRegister={(data: any) => handleRegister(selectedEvent, data)}
                onBack={() => setActiveScreen('event-details')}
              />
            )}
            {activeScreen === 'notifications' && <NotificationsScreen />}
            {activeScreen === 'live' && (
              <StreamHub 
                streams={streams.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onStreamSelect={(s) => {
                  setSelectedStream(s);
                  setActiveScreen('stream-player');
                }} 
              />
            )}
            {activeScreen === 'stream-player' && selectedStream && (
              <StreamPlayer 
                stream={selectedStream} 
                profile={profile!}
                onUpdateProfile={fetchProfile}
                onBack={() => setActiveScreen('live')} 
              />
            )}
            {activeScreen === 'attendee-management' && selectedEvent && (
              <AttendeeManagementScreen 
                event={selectedEvent} 
                onBack={() => setActiveScreen('event-details')} 
              />
            )}
          {activeScreen === 'go-live' && <BroadcasterScreen onBack={() => setActiveScreen('dashboard')} profile={profile} />}
          {activeScreen === 'donations' && <DonationDashboard profile={profile} onUpdate={() => fetchProfile()} />}
          {activeScreen === 'analytics' && <AnalyticsScreen />}
          {activeScreen === 'ai-planner' && <AIPlannerScreen />}
          {activeScreen === 'community' && <CommunityScreen />}
          {activeScreen === 'settings' && <SettingsScreen profile={profile} onUpdate={() => fetchProfile()} />}
          {activeScreen === 'onboarding' && <OnboardingScreen user={user} onComplete={() => { fetchProfile(); setActiveScreen('dashboard'); }} />}
        </Layout>
      </div>
    )}
  </AnimatePresence>
  );
}

function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

// --- Screens ---

function WelcomeScreen({ onLogin, isLoggedIn, onContinue }: { onLogin: () => void, isLoggedIn: boolean, onContinue: () => void }) {
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    try {
      await onLogin();
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 px-8 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[120%] h-[60%] bg-blue-600/20 blur-[140px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[80%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full" />
      
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-20 h-20 bg-white/10 backdrop-blur-3xl rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl border border-white/20 ring-1 ring-white/10 relative hover:bg-white/20 transition-all cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-blue-400/20 rounded-[2rem] animate-pulse" />
          <Radio className="text-white h-10 w-10 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)] relative z-10" />
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-black text-white mb-2 leading-tight tracking-[0.2em] uppercase whitespace-nowrap"
        >
          STREAMI<span className="text-blue-500">FY</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-500 font-bold text-[8px] uppercase tracking-[0.4em] mb-10 max-w-[240px] mx-auto leading-relaxed"
        >
          Divine Transmission Layer
        </motion.p>
        
        <Button 
          onClick={isLoggedIn ? onContinue : handleLogin} 
          disabled={loggingIn}
          size="lg" 
          className="w-full h-12 text-[10px] rounded-xl mb-6 bg-blue-600 text-white shadow-2xl shadow-blue-900/40 font-black uppercase tracking-[0.2em] hover:bg-blue-500 transition-all active:scale-[0.98] border-none"
        >
          {loggingIn ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            isLoggedIn ? "CONTINUE MISSION" : "INITIALIZE NODE"
          )}
        </Button>
        
        <div className="flex gap-4 items-center opacity-20">
           <div className="h-[1px] w-4 bg-white" />
           <p className="text-[7px] text-white font-bold uppercase tracking-[0.2em]">Authorized Access</p>
           <div className="h-[1px] w-4 bg-white" />
        </div>
      </div>
    </div>
  );
}

// --- Streamify Hub & Player ---

function StreamHub({ streams, onStreamSelect }: { streams: StreamSession[], onStreamSelect: (s: StreamSession) => void }) {
  const liveStreams = streams.filter(s => s.status === 'live');
  const scheduled = streams.filter(s => s.status === 'scheduled');

  return (
    <div className="screen-padding pb-32">
      <div className="mb-8 pt-4 px-2 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase text-blue-600 leading-none">Live<br/>Network</h2>
          <p className="text-[7px] text-slate-400 font-black mt-2 uppercase tracking-[0.3em]">Global Transmission</p>
        </div>
        {liveStreams.length > 0 && (
          <div className="px-3 py-1 bg-blue-50 rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
            <span className="text-[7px] font-black text-blue-600 uppercase tracking-widest">{liveStreams.length} Active</span>
          </div>
        )}
      </div>

      {liveStreams.length > 0 ? (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
            <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-800">Currently Broadcasting</h3>
          </div>
          <div className="space-y-4">
            {liveStreams.map(stream => (
              <motion.div 
                key={stream.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onStreamSelect(stream)}
                className="bg-white rounded-[2rem] overflow-hidden shadow-lg shadow-slate-100 border border-slate-50 flex flex-col relative"
              >
                <div className="relative aspect-video bg-slate-900">
                  <img src={stream.thumbnailUrl || "https://images.unsplash.com/photo-1510076857177-7470076d4098?auto=format&fit=crop&q=80&w=800"} alt="" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-white rounded-full animate-pulse" /> Live
                  </div>
                  {stream.isPremium && (
                    <div className="absolute top-3 left-14 bg-blue-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-lg border border-blue-400">
                      <Sparkles size={8} /> Premium
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1.5">
                    <Users size={8} /> {stream.viewers || 0}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                       <Play className="text-white fill-white ml-0.5 h-6 w-6" />
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none mb-1.5 uppercase">{stream.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight line-clamp-1">{stream.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
           <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 border border-dashed border-slate-200">
             <Tv className="text-slate-200 h-10 w-10" />
           </div>
           <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Static Silence</h3>
           <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] max-w-[200px] leading-relaxed">The network is currently offline.</p>
        </div>
      )}

      {scheduled.length > 0 && (
        <section className="mb-10">
          <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-1">Upcoming Missions</h3>
          <div className="space-y-3">
            {scheduled.map(stream => (
              <div key={stream.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-50 flex gap-4 items-center">
                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                  <img src={stream.thumbnailUrl} className="w-full h-full object-cover grayscale opacity-50" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-slate-800 text-[10px] uppercase leading-tight mb-1">{stream.title}</h4>
                  <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Scheduled</p>
                </div>
                <Button variant="ghost" className="rounded-full h-10 w-10 p-0 text-slate-300 hover:text-blue-600"><Bell size={16} /></Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Media Library</h3>
          <Button variant="ghost" className="text-blue-600 text-[8px] font-black uppercase tracking-widest p-0">Browse All</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: 'The Power of Grace', duration: '45 min', views: '2.4K', thumb: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?auto=format&fit=crop&q=80&w=400' },
            { title: 'Victory in Christ', duration: '32 min', views: '1.8K', thumb: 'https://images.unsplash.com/photo-1510076857177-7470076d4098?auto=format&fit=crop&q=80&w=400' }
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-50 group active:scale-95 transition-all">
               <div className="relative aspect-video">
                  <img src={item.thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[7px] font-black text-white">{item.duration}</div>
               </div>
               <div className="p-4">
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight line-clamp-1 mb-1">{item.title}</h4>
                  <div className="flex justify-between items-center opacity-60">
                     <span className="text-[7px] font-black uppercase">{item.views} Views</span>
                     <Sparkles size={8} className="text-blue-600" />
                  </div>
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StreamPlayer({ stream, profile, onUpdateProfile, onBack }: { stream: StreamSession, profile: UserProfile, onUpdateProfile: () => void, onBack: () => void }) {
  const [lang, setLang] = useState(profile?.preferredLanguage || 'en');
  const [showAI, setShowAI] = useState(true);
  const [transcript, setTranscript] = useState("Interfacing with Streamify Oral AI layer... Connecting to low-latency neural translation... Ready.");
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleActivateSubscription = async () => {
    if (!profile) return;
    const cost = 500; // 500 Espees
    
    if (profile.walletBalance < cost) {
      toast.error("Insufficient Espees balance for this mission. Please top up.");
      return;
    }

    setSubscribing(true);
    try {
      await updateDoc(doc(db, 'users', profile.userId), {
        walletBalance: profile.walletBalance - cost,
        subscriptionStatus: 'active',
        subscriptionExpiry: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      });
      toast.success("Divine Access Activated: Frequency Synchronized.");
      onUpdateProfile();
    } catch (e) {
      toast.error("Activation sequence interrupted.");
      console.error(e);
    } finally {
      setSubscribing(false);
    }
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const langMap: Record<string, string> = { 
      en: 'en-US', fr: 'fr-FR', es: 'es-ES', 
      ha: 'en-US', yo: 'en-US', ig: 'en-US', pi: 'en-US' 
    };
    const voice = voices.find(v => v.lang.startsWith(langMap[lang] || 'en'));
    if (voice) utterance.voice = voice;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const texts: Record<string, string> = {
      en: "The spirit of the Lord is moving in this session. Grace is being multiplied.",
      fr: "L'esprit du Seigneur agit dans cette session. La grâce est multipliée.",
      es: "El espíritu del Señor se está moviendo en esta sesión. La gracia se está multiplicando.",
      ha: "Ruhun Ubangiji yana motsi a cikin wannan zama. Ana ninka alheri.",
      yo: "Ẹ̀mí Olúwa ń gbé nínú ìpàdé yìí. Oore-ọ̀fẹ́ ń pọ̀ sí i.",
      ig: "Mmụọ nke Onyenwe anyị na-agagharị na nnọkọ a. A na-abawanye amara.",
      pi: "Dey spirit of Baba God dey move for inside dis session. Grace dey flows well well."
    };
    
    const interval = setInterval(() => {
      const newText = texts[lang] || texts['en'];
      setTranscript(newText);
      if (showAI) speak(newText);
    }, 10000);

    const initialText = texts[lang] || texts['en'];
    setTranscript(initialText);
    if (showAI) speak(initialText);

    return () => {
      clearInterval(interval);
      window.speechSynthesis?.cancel();
    };
  }, [lang, showAI]);

  useEffect(() => {
    // Simulate comments
    setComments([
      { id: 1, user: 'Bro. Samuel', text: 'Amen! Powerful message.', time: '2m ago' },
      { id: 2, user: 'Sis. Mary', text: 'God is good!', time: '1m ago' },
    ]);
  }, []);

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, { id: Date.now(), user: profile?.displayName || 'Unknown', text: newComment, time: 'Just now' }]);
    setNewComment("");
  };

  const isSubscribed = profile?.subscriptionStatus === 'active';
  const requiresSub = stream.isPremium && !isSubscribed;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden relative">
      {/* Video Area */}
      <div className="relative aspect-video bg-slate-900 group">
        <img src={stream.thumbnailUrl} className="w-full h-full object-cover opacity-50" alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        
        <button onClick={onBack} className="absolute top-6 left-6 h-10 w-10 flex items-center justify-center bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-white active:scale-90 transition-all z-20">
           <ChevronRight className="rotate-180" size={18} />
        </button>

        <div className="absolute bottom-6 left-6 right-6 z-10">
           <Badge className="bg-red-600 text-white border-none font-black text-[7px] uppercase tracking-widest px-2 mb-2 animate-pulse">Live Transmission</Badge>
           <h2 className="text-xl font-black text-white tracking-tight uppercase leading-none">{stream.title}</h2>
           <p className="text-[8px] text-white/60 font-black uppercase tracking-widest mt-2 flex items-center gap-2">
             <Users size={10} className="text-blue-400" /> {stream.viewers?.toLocaleString() || 0} Watchers
           </p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <motion.div 
             animate={{ scale: [1, 1.1, 1] }}
             transition={{ duration: 4, repeat: Infinity }}
             className="w-16 h-16 bg-blue-600/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20"
           >
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
           </motion.div>
        </div>
      </div>

      {/* Control Strip */}
      <div className="bg-slate-900/50 backdrop-blur-3xl border-y border-white/5 p-4 flex flex-col gap-4">
         <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
               <div className={cn("h-6 w-10 rounded-full border border-white/10 flex items-center px-1 cursor-pointer transition-all", showAI ? "bg-blue-600" : "bg-white/5")} onClick={() => setShowAI(!showAI)}>
                  <motion.div animate={{ x: showAI ? 16 : 0 }} className="h-4 w-4 bg-white rounded-full shadow-lg" />
               </div>
               <span className="text-[7px] font-black uppercase text-white/40 tracking-widest">Oral AI {showAI ? 'Active' : 'Muted'}</span>
            </div>
            
            <div className="flex gap-2">
               <Button variant="ghost" onClick={() => setIsLiked(!isLiked)} className={cn("h-10 w-10 rounded-xl", isLiked ? "bg-blue-600 text-white" : "bg-white/5 text-white/40")}>
                  <Heart size={16} className={isLiked ? "fill-white" : ""} />
               </Button>
               <Button variant="ghost" className="h-10 w-10 rounded-xl bg-white/5 text-white/40">
                  <Sparkles size={16} />
               </Button>
            </div>
         </div>

         <div className="flex gap-4 items-center">
            <div className="flex-1 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
               {BROADCAST_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={cn(
                      "px-4 h-9 rounded-xl text-[7px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shrink-0 flex items-center gap-2",
                      lang === l.code ? "bg-white text-slate-950 border-white" : "bg-white/5 text-white/40 border-white/5"
                    )}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
               ))}
            </div>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col p-4 gap-4">
         {/* Transcript Box */}
         <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-4 relative min-h-[80px]">
            <div className="absolute -top-1.5 left-4 px-2 bg-blue-600 rounded text-[6px] font-black text-white uppercase tracking-widest">Divine Transcript</div>
            <p className="text-[11px] font-medium text-white/80 leading-relaxed italic">
              {transcript}
            </p>
         </div>

         {/* Comments Area */}
         <div className="flex-1 flex flex-col bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex justify-between items-center">
               <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Spiritual Resonance</span>
               <span className="text-[6px] font-black text-blue-500 uppercase">Live</span>
            </div>
            <ScrollArea className="flex-1 p-4">
               <div className="space-y-4">
                  {comments.map((c: any) => (
                    <div key={c.id} className="flex gap-3 items-start">
                       <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[8px] font-black text-blue-600 bg-white">{c.user ? c.user[0] : '?'}</AvatarFallback>
                       </Avatar>
                       <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                             <span className="text-[8px] font-black text-white/80 uppercase">{c.user}</span>
                             <span className="text-[6px] text-white/20 font-bold">{c.time}</span>
                          </div>
                          <p className="text-[10px] text-white/60 font-medium leading-tight">{c.text}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </ScrollArea>
            <div className="p-4 border-t border-white/5 flex gap-2">
               <Input 
                 value={newComment}
                 onChange={e => setNewComment(e.target.value)}
                 className="h-10 bg-white/5 border-white/10 text-white rounded-xl text-xs font-medium placeholder:text-white/20" 
                 placeholder="Enter Resonance..."
                 onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
               />
               <Button onClick={handleSendComment} className="h-10 w-10 rounded-xl bg-blue-600 text-white shrink-0">
                  <ArrowRight size={16} />
               </Button>
            </div>
         </div>
      </div>
      
      {/* Premium Overlay */}
      {requiresSub && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8">
           <div className="w-20 h-20 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center mb-6 border border-blue-500/30">
              <Sparkles className="text-blue-500 h-10 w-10" />
           </div>
           <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Sacred Access<br/><span className="text-blue-500">Required</span></h2>
           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] max-w-[240px] leading-relaxed mb-10">This premium transmission frequency requires an active Espees Subscription.</p>
           <Button 
             onClick={handleActivateSubscription}
             disabled={subscribing}
             className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-900/50"
           >
              {subscribing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {subscribing ? "Activating..." : "Activate Subscription (500 SP)"}
           </Button>
           <Button variant="ghost" onClick={onBack} className="mt-4 text-white/40 text-[8px] font-black uppercase tracking-widest">Return to Hub</Button>
        </div>
      )}
    </div>
  );
}

function Dashboard({ user, profile, events, onEventClick, onActionClick }: any) {
  const todayCount = 124;
  const growth = "+12%";

  return (
    <div className="screen-padding bg-slate-50/50 min-h-full pb-24">
      <header className="flex justify-between items-start mb-6 pt-2">
        <div>
          <h2 className="text-lg font-black text-blue-600 tracking-tight leading-none uppercase">Shalom, {user?.displayName?.split(' ')[0]}</h2>
          <p className="text-[8px] text-blue-400 mt-1.5 font-black uppercase tracking-widest opacity-60">{profile?.churchName || 'Kingdom Member'}</p>
        </div>
        <div className="relative group cursor-pointer" onClick={() => onActionClick('profile')}>
          <Avatar className="h-9 w-9 border-2 border-white shadow-lg transition-transform group-active:scale-95">
            <AvatarImage src={user?.photoURL} />
            <AvatarFallback className="bg-blue-600 text-white font-bold">{user?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-blue-600 border-none text-white shadow-xl shadow-blue-100 overflow-hidden relative rounded-[1.5rem] p-4 cursor-pointer active:scale-[0.98] transition-all" onClick={() => onActionClick('analytics')}>
          <p className="text-[8px] font-black text-blue-100 uppercase tracking-widest opacity-80">Impact Reach</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black tracking-tighter">1,240</span>
            <span className="text-[7px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase">{growth}</span>
          </div>
          <Users className="absolute right-[-5px] bottom-[-5px] opacity-10" size={40} />
        </Card>
        
        <Card className="bg-white border-none shadow-sm relative overflow-hidden rounded-[1.5rem] p-4 cursor-pointer active:scale-[0.98] transition-all" onClick={() => onActionClick('donations')}>
          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Espees Wallet</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-blue-600 tracking-tighter">{profile?.walletBalance?.toLocaleString() || 0}</span>
            <span className="text-[7px] font-black text-blue-400 tracking-widest uppercase ml-0.5">ESP</span>
          </div>
          <Heart className="absolute right-[-5px] bottom-[-5px] text-blue-50 opacity-50" size={40} />
        </Card>
      </div>

      {/* Verified/Endorsed Go Live Action */}
      {(profile?.role === 'visionary' || profile?.verificationStatus === 'verified') && (
        <Card 
          onClick={() => onActionClick('go-live')}
          className="bg-red-600 border-none text-white shadow-xl shadow-red-900/20 mb-6 p-6 relative overflow-hidden rounded-[2rem] cursor-pointer hover:bg-red-500 transition-all active:scale-[0.98] group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[80px] rounded-full -mr-10 -mt-10" />
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <p className="text-[8px] font-black text-rose-200 uppercase tracking-[0.3em] mb-2">Broadcaster Permission Granted</p>
              <h3 className="text-xl font-black uppercase tracking-tighter leading-tight">Start Celestial<br/>Transmission</h3>
            </div>
            <div className="bg-white/20 p-4 rounded-full group-hover:scale-110 transition-transform">
               <Radio size={24} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </div>
          </div>
        </Card>
      )}

      {/* AI Strategist Shortcut */}
      <Card className="mb-6 border-none bg-blue-900 text-white shadow-2xl relative overflow-hidden rounded-[2rem] group cursor-pointer active:scale-[0.99] transition-all" onClick={() => onActionClick('ai-planner')}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000" />
        <CardHeader className="p-5 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-blue-600 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <Badge className="bg-blue-500/20 text-blue-300 border-none font-black text-[7px] uppercase tracking-widest px-2">Divine AI Active</Badge>
          </div>
          <CardTitle className="text-base font-black tracking-tight text-blue-400">Strategy Lab</CardTitle>
          <CardDescription className="text-slate-400 text-[8px] leading-relaxed max-w-[160px] font-bold uppercase tracking-tight">Draft outreach campaigns with Divine Intelligence.</CardDescription>
        </CardHeader>
      </Card>

      {/* Featured Events */}
      <section>
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="font-black text-[9px] text-blue-600 uppercase tracking-[0.3em]">Featured Events</h3>
          <Button variant="ghost" onClick={() => onActionClick('events')} className="text-blue-600 hover:text-blue-700 font-black p-0 text-[8px] uppercase tracking-widest">View All</Button>
        </div>
        <div className="space-y-3">
          {events.slice(0, 3).map((event: any) => (
            <EventCard key={event.id} event={event} onClick={() => onEventClick(event)} />
          ))}
          {events.length === 0 && (
            <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-slate-200">
              <Calendar className="mx-auto h-6 w-6 mb-2 text-slate-200" />
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">Awaiting Prophetic Events</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function EventCard({ event, onClick }: any) {
  const dateStr = event.date?.toDate ? event.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Date TBD';
  
  return (
    <Card className="hover:shadow-md transition-all duration-300 border-none shadow-sm overflow-hidden cursor-pointer group rounded-2xl active:scale-[0.98] hover:border-blue-100 border border-transparent" onClick={onClick}>
      <CardContent className="p-0 flex h-24">
        <div className="w-20 bg-slate-100 overflow-hidden relative shrink-0">
          <img 
            src={event.bannerUrl || `https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=300&q=80`} 
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            alt="Event"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <Badge className="absolute top-1.5 left-1.5 bg-white/90 backdrop-blur-sm text-slate-900 border-none text-[6px] font-black uppercase tracking-tight py-0.5 px-1 rounded shadow-sm">{event.category}</Badge>
        </div>
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h4 className="font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors uppercase tracking-tight text-[10px] line-clamp-1">{event.title}</h4>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
              <MapPin size={8} className="text-blue-400" /> {event.location}
            </p>
          </div>
          <div className="flex justify-between items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-blue-600 font-black text-lg tracking-tighter leading-none">{event.date?.toDate ? event.date.toDate().getDate() : '??'}</span>
              <span className="text-[7px] text-slate-400 font-medium uppercase tracking-widest leading-none">{dateStr.split(' ')[0]}</span>
            </div>
            <div className="h-6 w-6 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <ChevronRight size={12} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetails({ event, isRegistered, onRegister, onManageAttendees, onBack, profile }: any) {
  const isAdmin = profile?.role === 'visionary' || profile?.role === 'admin' || profile?.isAdmin;
  const dateObj = event.date?.toDate ? event.date.toDate() : null;
  const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date TBD';
  const timeStr = dateObj ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Time TBD';

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Banner Section */}
      <div className="relative h-64 w-full bg-slate-100 overflow-hidden">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          src={event.bannerUrl || `https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800&q=80`} 
          className="h-full w-full object-cover"
          alt="Event banner"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="absolute top-5 left-5 h-10 w-10 bg-white/20 backdrop-blur-xl rounded-full text-white hover:bg-white/40 active:scale-90 transition-all border border-white/20"
        >
          <ChevronRight className="rotate-180 h-4 w-4" />
        </Button>
      </div>

      {/* Content Section */}
      <div className="px-6 -mt-8 bg-white rounded-t-[2.5rem] relative pt-8 pb-8 border-t border-slate-50">
        <div className="flex justify-center mb-6">
          <div className="w-10 h-1 bg-slate-100 rounded-full" />
        </div>

        <Badge className="mb-4 bg-blue-50 text-blue-600 border-none font-black uppercase tracking-[0.2em] text-[7px] py-0.5 px-2.5">
          {event.category}
        </Badge>
        
        <h2 className="text-2xl font-black text-slate-900 mb-6 leading-[1.1] tracking-tighter uppercase">{event.title}</h2>
        
        <div className="grid grid-cols-1 gap-5 mb-8">
          <div className="flex gap-3 items-start">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100 shrink-0">
              <Calendar className="h-4 w-4 text-white" />
            </div>
            <div className="pt-0.5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Date & Time</p>
              <p className="font-black text-slate-800 tracking-tight text-xs">{dateStr}</p>
              <p className="text-[10px] font-bold text-blue-600 mt-0.5">{timeStr}</p>
            </div>
          </div>
          
          <div className="flex gap-3 items-start">
            <div className="bg-slate-900 p-2.5 rounded-xl shrink-0">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div className="pt-0.5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">The Sanctuary</p>
              <p className="font-black text-slate-800 tracking-tight text-xs">{event.location}</p>
              <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">{event.venueType}</p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="bg-blue-50 p-2.5 rounded-xl shrink-0">
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>
            <div className="pt-0.5">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Minstrel / Speaker</p>
              <p className="font-black text-slate-800 tracking-tight text-xs">{event.speaker || 'Council of Elders'}</p>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3">Prophetic Mandate</h4>
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-50">
            <p className="text-slate-600 leading-relaxed text-[11px] font-bold italic">
              "{event.description || 'A gathering of saints to experience the supernatural power of God through worship and word.'}"
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {isRegistered ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-slate-900 rounded-3xl flex flex-col items-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl" />
              <div className="relative z-10 flex flex-col items-center">
                <p className="text-white font-black uppercase text-[8px] tracking-[0.3em] mb-4">Confirmed Participant</p>
                <div className="p-3 bg-white rounded-2xl shadow-xl">
                  <QRCodeSVG value={`TICKET-${event.id}`} size={110} />
                </div>
                <p className="text-[7px] text-slate-400 mt-4 font-black tracking-widest uppercase">Valid for One Entrance</p>
              </div>
            </motion.div>
          ) : (
            <Button 
              size="lg" 
              onClick={onRegister} 
              className="h-14 rounded-xl bg-blue-600 text-sm font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] border-none"
            >
              Secure My Attendance
            </Button>
          )}

          {isAdmin && (
            <Button 
              variant="outline" 
              onClick={onManageAttendees}
              className="mt-4 w-full h-14 rounded-2xl border-dashed border-blue-200 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
            >
              <Users size={16} /> Manage Attendees
            </Button>
          )}
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-12 rounded-xl border-none bg-slate-50 text-slate-600 font-black text-[8px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all">Share Vision</Button>
            <Button variant="outline" className="flex-1 h-12 rounded-xl border-none bg-slate-50 text-slate-600 font-black text-[8px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all">Support Event</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventList({ events, onEventClick }: any) {
  return (
    <div className="screen-padding pb-24">
      <div className="flex justify-between items-end mb-6 px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tighter uppercase text-blue-600 leading-none">Holy<br/>Gatherings</h2>
          <p className="text-[7px] text-slate-400 font-black mt-2 uppercase tracking-[0.3em]">Celestial Database</p>
        </div>
        <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[7px] mb-1 px-2 py-0.5">{events.length} Live</Badge>
      </div>

      {events.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {events.map((event: any) => (
            <EventCard key={event.id} event={event} onClick={() => onEventClick(event)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
          <div className="w-28 h-28 bg-slate-50 rounded-[3rem] flex items-center justify-center mb-10 border-2 border-dashed border-slate-200">
            <Calendar className="h-10 w-10 text-slate-200" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight uppercase">Prophetic Pause</h3>
          <p className="text-xs text-slate-400 font-black uppercase leading-relaxed max-w-[240px] tracking-tight">The registry is currently untouched. No holy gatherings are scheduled at this coordinate.</p>
          
          <div className="mt-12 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
        </div>
      )}
    </div>
  );
}

function ProfileScreen({ user, profile, registrations, events, onLogout, onNavigate }: any) {
  const registeredEvents = events.filter((e: any) => registrations.some((r: any) => r.eventId === e.id));
  const checkins = registrations.filter((r: any) => r.status === 'Checked-in').length;

  return (
    <div className="screen-padding flex flex-col min-h-full bg-blue-50/30 pb-24 pt-6">
      <div className="mb-4 pt-4 px-2">
        <h2 className="text-2xl font-black tracking-tighter uppercase text-blue-600 leading-none">Spiritual<br/>Profile</h2>
        <p className="text-[7px] text-slate-400 font-black mt-2 uppercase tracking-[0.3em]">Kingdom Identity Card</p>
      </div>

      <header className="flex items-center gap-4 mb-8 bg-blue-600 p-6 rounded-[2.5rem] shadow-2xl shadow-blue-200 border border-blue-500 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-8 -mt-8 opacity-40" />
        
        <div className="relative shrink-0">
          <Avatar className="h-16 w-16 border-2 border-white/50 shadow-xl ring-2 ring-blue-400">
            <AvatarImage src={user?.photoURL} />
            <AvatarFallback className="text-xl font-bold bg-white text-blue-600">{user?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-white tracking-tight leading-none uppercase mb-1 truncate">{user?.displayName}</h2>
          <p className="text-blue-100 font-bold text-[7px] tracking-[0.1em] uppercase mb-2 truncate opacity-80">{profile?.churchName || 'Holy Citizen'}</p>
          <div className="flex flex-wrap gap-1">
            <Badge className="bg-white/20 text-white border-none font-black text-[6px] uppercase tracking-widest px-2 py-0.5">{profile?.role || 'Attendee'}</Badge>
            {profile?.verificationStatus === 'verified' && (
              <Badge className="bg-white text-blue-600 border-none font-black text-[6px] uppercase tracking-widest px-2 py-0.5 flex items-center gap-1">
                <Sparkles size={6} className="fill-blue-600" /> Verified
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Endorsement Info for Individuals */}
      {profile?.endorsedBy && (
        <div className="mx-1 mb-8 bg-blue-600/5 border border-blue-100 p-5 rounded-3xl relative overflow-hidden">
           <div className="absolute top-0 right-0 px-3 py-1 bg-blue-600 rounded-bl-xl text-[6px] font-black text-white uppercase tracking-widest">Endorsed Minister</div>
           <div className="flex gap-3 items-center">
              <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
                 <Sparkles size={16} />
              </div>
              <div>
                 <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1.5">Ecclesiastical Endorsement</p>
                 <p className="text-xs font-black text-blue-900 tracking-tight">{profile.endorsedByTitle}</p>
              </div>
           </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-8 px-1">
        {[
          { label: 'Gateways', val: registeredEvents.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-white' },
          { label: 'Impacts', val: checkins, icon: Sparkles, color: 'text-blue-400', bg: 'bg-white' },
          { label: 'Espees', val: profile?.walletBalance?.toLocaleString(), icon: Heart, color: 'text-blue-600', bg: 'bg-white' }
        ].map(stat => (
          <div key={stat.label} className={cn("p-3 rounded-2xl border border-blue-50 shadow-sm flex flex-col items-center text-center", stat.bg)}>
            <stat.icon size={10} className={cn("mb-1.5", stat.color)} />
            <span className="text-xs font-black text-blue-900 tracking-tighter">{stat.val}</span>
            <span className="text-[6px] font-black uppercase text-blue-400 tracking-widest mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="w-full space-y-3">
        <div className="flex justify-between items-center px-4 mb-2">
          <h4 className="text-[8px] font-black text-blue-400 uppercase tracking-[0.4em]">Prophetic Registry</h4>
          <div className="h-[1px] flex-1 bg-blue-100 mx-4" />
        </div>

        <div className="space-y-2 mb-6">
           {[
             ...(registeredEvents.length > 0 ? [{ type: 'event', label: `Registered for ${registeredEvents[0].title}`, date: 'Recent' }] : []),
             { type: 'donation', label: 'Wallet Seed Planted', date: 'Oct 24' },
             { type: 'system', label: 'Spiritual ID Synchronized', date: 'Account Creation' }
           ].map((act, i) => (
             <div key={i} className="flex gap-3 items-center bg-white p-3 rounded-2xl shadow-sm border border-blue-50">
                <div className={cn(
                  "p-2 rounded-xl",
                  act.type === 'event' ? 'bg-blue-50 text-blue-600' : 
                  act.type === 'donation' ? 'bg-blue-50 text-blue-600' : 'bg-blue-50/50 text-blue-400'
                )}>
                  {act.type === 'event' ? <Calendar size={10} /> : act.type === 'donation' ? <Heart size={10} /> : <Users size={10} />}
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-blue-900 uppercase tracking-tight leading-none">{act.label}</p>
                  <p className="text-[7px] text-blue-300 font-bold uppercase tracking-widest mt-1">{act.date}</p>
                </div>
             </div>
           ))}
        </div>

        <Button variant="outline" onClick={() => onNavigate('donations')} className="w-full h-14 rounded-2xl border border-blue-100 shadow-sm bg-white justify-between px-5 hover:bg-blue-50 active:scale-[0.98] transition-all group">
          <div className="flex items-center">
            <div className="bg-blue-50 p-2 rounded-lg shadow-sm mr-3">
              <Heart className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-left">
              <span className="font-black text-blue-900 block text-[9px] uppercase tracking-tight">Espees Wallet</span>
              <span className="text-[8px] font-black text-blue-600 tracking-widest uppercase">{profile?.walletBalance?.toLocaleString()} ESP</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-blue-200" />
        </Button>

        {profile?.accountType === 'organization' && (
           <EndorsementHub profile={profile} onUpdate={onNavigate} />
        )}

        <Button variant="outline" className="w-full h-14 rounded-2xl border-none shadow-xl shadow-red-200 bg-red-600 text-white font-black text-[8px] uppercase tracking-[0.2em] hover:bg-red-700 transition-all mt-6 active:scale-[0.98]" onClick={onLogout}>
           Deactivate Connection
        </Button>
      </div>
    </div>
  );
}

function EndorsementHub({ profile, onUpdate }: { profile: UserProfile, onUpdate: () => void }) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);

  const handleEndorse = async () => {
    if (!email) return toast.error("Enter candidate email");
    setSearching(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error("Soul not found in registry.");
        return;
      }
      const targetUser = snap.docs[0];
      const targetData = targetUser.data() as UserProfile;

      if (targetData.accountType !== 'individual') {
        toast.error("Can only endorse individual ministers.");
        return;
      }

      await updateDoc(doc(db, 'users', targetUser.id), {
        endorsedBy: profile.userId,
        endorsedByTitle: profile.churchName,
        verificationStatus: 'verified' 
      });

      await updateDoc(doc(db, 'users', profile.userId), {
        endorsedUsers: arrayUnion(targetUser.id)
      });

      toast.success(`${targetData.displayName} has been endorsed.`);
      setEmail("");
      onUpdate();
    } catch (e) {
      toast.error("Endorsement sequence failed.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-blue-50 p-6 shadow-xl shadow-blue-50/50 mt-4 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full" />
      <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Sparkles size={12} /> Ministry Endorsement
      </h4>
      
      <div className="space-y-4">
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          Empower ministers from your organization (e.g. musicians, artists) to host live transmissions under your verified umbrella.
        </p>
        
        <div className="flex gap-2">
           <Input 
             placeholder="Minister's Registry Email" 
             value={email}
             onChange={e => setEmail(e.target.value)}
             className="h-10 bg-blue-50/20 border-blue-50 rounded-xl text-[10px] font-bold text-blue-900"
           />
           <Button onClick={handleEndorse} disabled={searching} className="h-10 bg-blue-600 text-white rounded-xl px-4 text-[8px] font-black uppercase tracking-widest shrink-0">
             {searching ? <Loader2 className="animate-spin" size={12} /> : "Endorse"}
           </Button>
        </div>
        {profile?.endorsedUsers && profile.endorsedUsers.length > 0 && (
          <div className="pt-4 border-t border-blue-50">
            <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Active Endorsements: {profile.endorsedUsers.length}</p>
          </div>
        )}
      </div>
    </div>
  );
}
// --- New Feature Screens ---

function BroadcasterScreen({ onBack, profile }: { onBack: () => void, profile: UserProfile }) {
  const [isLive, setIsLive] = useState(false);
  const [streamTitle, setStreamTitle] = useState("");

  const handleGoLive = () => {
    if (!streamTitle) return toast.error("Enter a title for the transmission");
    setIsLive(true);
    toast.success("Broadcast frequency established. You are LIVE.");
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden relative">
       {/* UI for Broadcaster */}
       <div className="relative flex-1 bg-black overflow-hidden">
          {isLive ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
               <div className="absolute inset-0 bg-red-600/5 animate-pulse" />
               <div className="relative z-10 flex flex-col items-center">
                  <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center animate-ping absolute opacity-20" />
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center relative shadow-[0_0_50px_rgba(220,38,38,0.5)]">
                     <Radio className="text-white h-10 w-10" />
                  </div>
                  <h3 className="text-white font-black text-2xl uppercase tracking-tighter mt-12 animate-pulse">TRANSMITTING LIVE</h3>
                  <p className="text-red-400 font-bold text-[8px] uppercase tracking-[0.4em] mt-4">DIVINE FREQUENCY : 104.7 MHZ</p>
               </div>
               
               <div className="absolute bottom-10 left-10 right-10 flex flex-col gap-4">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl">
                     <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-2">Oral AI Interpreter</p>
                     <p className="text-[10px] text-white/60 font-medium italic">"Translating your message to 7 celestial languages in real-time..."</p>
                  </div>
                  <Button variant="outline" onClick={() => setIsLive(false)} className="h-14 rounded-2xl border-none bg-red-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-red-700">Terminate Transmission</Button>
               </div>
            </div>
          ) : (
            <div className="w-full h-full p-8 flex flex-col justify-center items-center text-center">
               <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mb-10">
                  <Play className="text-white h-10 w-10 ml-1" />
               </div>
               <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4">Ready to reach<br/>the nations?</h2>
               <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] max-w-[240px] leading-relaxed mb-10">Your message will be instantly localized via the Streamify Oral AI Layer.</p>
               
               <div className="w-full max-w-sm space-y-4">
                  <Input 
                    placeholder="Transmission Title..." 
                    value={streamTitle}
                    onChange={e => setStreamTitle(e.target.value)}
                    className="h-16 bg-white/5 border-white/10 text-white text-lg font-black placeholder:text-white/10 rounded-2xl px-6"
                  />
                  <Button onClick={handleGoLive} className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/50">
                    Prophetic Activation
                  </Button>
                  <Button variant="ghost" onClick={onBack} className="text-white/40 font-black text-[8px] uppercase tracking-widest">Return to Hub</Button>
               </div>
            </div>
          )}
       </div>
    </div>
  );
}

function AnalyticsScreen() {
  return (
    <div className="screen-padding pb-24">
      <h2 className="text-4xl font-black mb-10 tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600 leading-none">Streamify<br/>Analytics</h2>
      <div className="grid grid-cols-1 gap-4">
        <Card className="rounded-[1.5rem] border-none bg-blue-600 text-white p-6 relative overflow-hidden shadow-2xl shadow-blue-100">
          <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-white/10 rounded-full blur-xl" />
          <h3 className="text-[9px] font-black opacity-80 mb-1 uppercase tracking-widest">Total Souls Reached</h3>
          <div className="text-4xl font-black tracking-tighter">12,840</div>
          <p className="text-[8px] font-black mt-4 text-blue-100 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="bg-white/20 px-1 py-0.5 rounded">↑ 15.2%</span> VS LAST MONTH
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-2">
           <Card className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Viewing</p>
              <div className="text-2xl font-black text-slate-900 tracking-tighter">42m</div>
           </Card>
           <Card className="bg-white p-6 rounded-[2rem] border border-slate-50 shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Transcripts</p>
              <div className="text-2xl font-black text-slate-900 tracking-tighter">1,240</div>
           </Card>
        </div>
        
        <div className="space-y-3 mt-4">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Language Penetration</h4>
          {[
            { label: 'English Broadcast', value: '45%', color: 'bg-blue-500' },
            { label: 'French AI Audio', value: '28%', color: 'bg-blue-400' },
            { label: 'Hausa Subtitles', value: '15%', color: 'bg-rose-500' },
            { label: 'Others', value: '12%', color: 'bg-slate-300' }
          ].map(stat => (
            <div key={stat.label} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${stat.color}`} />
                <span className="font-black text-[10px] uppercase text-slate-600 tracking-tight">{stat.label}</span>
              </div>
              <span className="font-black text-slate-900 text-sm tracking-tighter">{stat.value}</span>
            </div>
          ))}
        </div>

        <Card className="mt-4 p-6 rounded-[2rem] bg-slate-900 border-none text-white relative overflow-hidden">
           <div className="flex justify-between items-center">
             <div>
               <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Upcoming Milestone</p>
               <h4 className="font-black text-sm uppercase tracking-tight">50k Souls Vision</h4>
             </div>
             <div className="h-10 w-10 rounded-full border-2 border-blue-500/30 flex items-center justify-center text-[10px] font-black">
               72%
             </div>
           </div>
           <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
             <div className="bg-blue-500 h-full w-[72%]" />
           </div>
        </Card>
      </div>
    </div>
  );
}

function DonationDashboard({ profile, onUpdate }: any) {
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    setLoading(true);
    try {
      const newBalance = (profile?.walletBalance || 0) + 1000;
      await setDoc(doc(db, 'users', profile.userId), { walletBalance: newBalance }, { merge: true });
      toast.success("Successfully topped up! +1,000 ESP");
      onUpdate();
    } catch (e) {
      toast.error("Process failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayPlaceholder = () => {
    toast.info("Espees Payment Processing Initiated", {
      description: "Redirecting to secure gateway (Simulation)",
      icon: <Sparkles className="h-4 w-4 text-blue-500" />
    });
  };

  return (
    <div className="screen-padding bg-slate-50/10 min-h-full pb-24">
      <h2 className="text-2xl font-black mb-6 tracking-tighter uppercase text-blue-600 leading-none">Giving<br/>Portal</h2>
      
      <Card className="bg-slate-950 text-white rounded-[2rem] p-8 mb-6 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full -mr-10 -mt-10" />
        
        <div className="relative z-10">
          <p className="text-[8px] font-black text-blue-300 uppercase tracking-[0.3em] mb-2">Available Espees</p>
          <div className="flex items-baseline gap-2 mb-8">
            <span className="text-4xl font-black tracking-tighter">{profile?.walletBalance?.toLocaleString() || 0}</span>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">ESP</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              disabled={loading}
              onClick={handleTopUp}
              className="bg-white text-slate-950 font-black h-12 rounded-xl hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-black/20 text-[10px] uppercase tracking-widest"
            >
              <Plus className="mr-2 h-3 w-3" /> Top Up
            </Button>
            <Button 
              onClick={handlePayPlaceholder}
              className="bg-blue-600 text-white font-black h-12 rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-900/20 text-[10px] uppercase tracking-widest border border-blue-400/20"
            >
              <ArrowRight className="mr-2 h-3 w-3" /> Pay
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex justify-between items-center px-2">
          <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Spiritual Deeds</h4>
          <Badge variant="outline" className="text-[6px] font-black border-slate-200 uppercase">History</Badge>
        </div>
        {[
          { icon: Heart, label: 'Tithe Offering', amt: '-500', date: 'Today' },
          { icon: Sparkles, label: 'Crusade Pledge', amt: '-1,200', date: 'Oct 21' },
          { icon: Plus, label: 'Wallet Credit', amt: '+10,000', date: 'Oct 20' }
        ].map((item, i) => (
          <div key={i} className="bg-white p-3.5 rounded-xl flex justify-between items-center shadow-sm border border-slate-50 active:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl", item.amt.startsWith('+') ? 'bg-blue-50' : 'bg-slate-50')}>
                <item.icon className={cn("h-3 w-3", item.amt.startsWith('+') ? 'text-blue-600' : 'text-slate-400')} />
              </div>
              <div>
                <p className="font-black text-slate-800 text-[10px] uppercase tracking-tight leading-none">{item.label}</p>
                <p className="text-[7px] text-slate-400 mt-1 font-bold uppercase tracking-tighter">{item.date}</p>
              </div>
            </div>
            <span className={cn("font-black text-xs tracking-tighter", item.amt.startsWith('+') ? 'text-blue-600' : 'text-slate-900')}>
              {item.amt} <span className="text-[7px]">ESP</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingScreen({ user, onComplete }: any) {
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<'individual' | 'organization'>('individual');
  const [church, setChurch] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [prefLang, setPrefLang] = useState('en');
  const [isVisionary, setIsVisionary] = useState(true);

  const handleSubmit = async (isDemo = false) => {
    let finalData: any = {
      accountType,
      churchName: isDemo ? "Bethany Global Center (Demo)" : church,
      orgEmail: isDemo ? "mission@bethany.org" : orgEmail,
      preferredLanguage: isDemo ? 'en' : prefLang,
      role: isVisionary ? 'visionary' : 'attendee',
      verificationStatus: isDemo ? 'verified' : (accountType === 'organization' ? 'pending' : 'none'),
      onboarded: true,
      walletBalance: isDemo ? 50000 : 1000,
      subscriptionStatus: isDemo ? 'active' : 'inactive',
      isVerified: isDemo,
      isAdmin: isVisionary || accountType === 'organization'
    };

    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), finalData, { merge: true });
      toast.success(isDemo ? "Authorized: Demo Organization Active." : "Divine Profile Synchronized.");
      onComplete();
    } catch (e) {
      toast.error("Profile synchronization failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 p-6 overflow-y-auto pb-20">
      <div className="pt-6 mb-8 relative">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 blur-[50px] rounded-full" />
        <div className="bg-blue-500 h-1 w-12 rounded-full mb-6" />
        <h2 className="text-3xl font-black text-white tracking-tighter leading-[0.85] uppercase mb-3">Divine<br/><span className="text-blue-400">Onboarding</span></h2>
        <p className="text-slate-400 font-bold uppercase text-[8px] tracking-[0.4em] leading-relaxed">Establish your spiritual presence in the network.</p>
      </div>

      <div className="space-y-6 flex-1 relative z-10">
        {/* Account Type */}
        <div className="space-y-2">
          <Label className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Vocation Classification</Label>
          <div className="grid grid-cols-2 gap-3">
             <button 
                onClick={() => setAccountType('individual')}
                className={cn("p-4 rounded-2xl border transition-all text-center", accountType === 'individual' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-500')}
             >
                <User size={18} className="mx-auto mb-2" />
                <p className="text-[9px] font-black uppercase tracking-widest leading-none">Individual</p>
                <p className="text-[6px] opacity-40 font-bold uppercase mt-1">Minister/Artist</p>
             </button>
             <button 
                onClick={() => setAccountType('organization')}
                className={cn("p-4 rounded-2xl border transition-all text-center", accountType === 'organization' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-slate-500')}
             >
                <Users size={18} className="mx-auto mb-2" />
                <p className="text-[9px] font-black uppercase tracking-widest leading-none">Organization</p>
                <p className="text-[6px] opacity-40 font-bold uppercase mt-1">Church/Ministry</p>
             </button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-4 bg-white/5 p-5 rounded-3xl border border-white/5">
          <div className="space-y-2">
            <Label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity Nomenclature</Label>
            <Input 
              placeholder={accountType === 'organization' ? "Church/Organization Name" : "Display Name"}
              className="h-12 bg-transparent border-white/10 text-white rounded-xl px-4 font-bold text-xs"
              value={church}
              onChange={e => setChurch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Preferred Frequency (Language)</Label>
            <Select onValueChange={setPrefLang} value={prefLang}>
               <SelectTrigger className="h-12 bg-transparent border-white/10 text-white rounded-xl px-4 font-bold text-xs">
                  <SelectValue placeholder="Select Language" />
               </SelectTrigger>
               <SelectContent className="bg-slate-900 border-white/10 text-white font-bold">
                  {BROADCAST_LANGUAGES.map(l => (
                    <SelectItem key={l.code} value={l.code}>{l.flag} {l.label} ({l.region})</SelectItem>
                  ))}
               </SelectContent>
            </Select>
          </div>
        </div>

        <button 
          onClick={() => handleSubmit(true)}
          className="w-full h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 font-bold text-[9px] uppercase tracking-[0.25em] flex items-center justify-center gap-2 hover:bg-blue-600/20 transition-all active:scale-95"
        >
           <Sparkles size={12} /> Auto-Initialize Demo Organization
        </button>
      </div>

      <Button 
        onClick={() => handleSubmit(false)} 
        disabled={loading}
        className="w-full h-16 rounded-[2rem] bg-white text-slate-950 font-black text-base uppercase tracking-widest shadow-2xl shadow-blue-900/50 hover:bg-slate-100 active:scale-95 transition-all mt-8 shrink-0"
      >
        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Authorize Profile"}
      </Button>
    </div>
  );
}

function AIPlannerScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [prompt, setPrompt] = useState({ title: '', details: '', eventId: '' });
  const [userEvents, setUserEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserEvents = async () => {
      if (!auth.currentUser) return;
      const q = query(collection(db, "events"), where("creatorId", "==", auth.currentUser.uid));
      const snap = await getDocs(q);
      setUserEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchUserEvents();
  }, []);

  const generatePlan = async () => {
    const title = prompt.eventId ? userEvents.find(e => e.id === prompt.eventId)?.title : prompt.title;
    if (!title) return toast.error("Select an event or enter a campaign focus");
    
    setLoading(true);
    try {
      const resp = await fetch('/api/ai/outreach-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventTitle: title, category: 'Church Outreach', description: prompt.details })
      });
      const data = await resp.json();
      setResult(data.plan);
    } catch (e) {
      toast.error("Strategy generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-padding flex flex-col min-h-full pb-24">
      <h2 className="text-2xl font-black mb-2 tracking-tighter uppercase text-blue-600 leading-none">Strategist<br/>Intelligence</h2>
      <p className="text-[7px] text-slate-400 font-black mb-6 uppercase tracking-[0.3em] leading-relaxed">Divine wisdom meets algorithmic precision.</p>
      
      {!result ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Link to Event (Optional)</Label>
            <Select onValueChange={v => setPrompt({ ...prompt, eventId: v })} value={prompt.eventId}>
              <SelectTrigger className="h-10 rounded-xl bg-white border-slate-100 font-bold text-blue-600 px-4 text-[10px]">
                <SelectValue placeholder="Identify Active Mission" />
              </SelectTrigger>
              <SelectContent>
                {userEvents.map(e => (
                   <SelectItem key={e.id} value={e.id} className="text-[10px]">{e.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {!prompt.eventId && (
            <div className="space-y-2">
              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Campaign Vision</Label>
              <Input 
                placeholder="e.g. Back-to-School Rural Outreach"
                className="h-10 rounded-xl bg-white border-slate-100 font-bold text-blue-600 px-4 text-[10px]"
                value={prompt.title}
                onChange={e => setPrompt({ ...prompt, title: e.target.value })}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Core Goals</Label>
            <textarea 
              placeholder="List specific targets or local challenges..."
              className="w-full min-h-[100px] p-4 rounded-xl bg-white border border-slate-100 font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:font-normal text-[10px]"
              value={prompt.details}
              onChange={e => setPrompt({ ...prompt, details: e.target.value })}
            />
          </div>
          <Button onClick={generatePlan} disabled={loading} className="w-full h-10 rounded-xl bg-blue-600 font-bold text-[10px] shadow-xl shadow-blue-100 mt-2 hover:bg-blue-700 transition-all uppercase tracking-widest">
            {loading ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : <Sparkles className="h-3 w-3 mr-2" />}
            {loading ? "Counseling..." : "Architect Outreach Strategy"}
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-xl border border-slate-50 animate-in slide-in-from-bottom-5 duration-700">
           <div className="flex justify-between items-center mb-3">
              <span className="text-[8px] font-black text-blue-600 uppercase tracking-[0.3em]">Strategy Drafted</span>
              <Button variant="ghost" onClick={() => setResult('')} className="text-[7px] font-bold uppercase tracking-tight text-slate-400 h-auto p-0">Reset</Button>
           </div>
           <div className="prose prose-slate prose-sm text-slate-600 h-[260px] overflow-y-auto pr-1 custom-scrollbar italic leading-relaxed text-[10px]">
             {result.split('\n').map((line, i) => (
                <p key={i} className="mb-2">{line}</p>
             ))}
           </div>
           <Button className="w-full h-10 mt-4 rounded-xl bg-slate-900 font-bold text-[10px] uppercase tracking-widest">Implement Plan</Button>
        </div>
      )}
    </div>
  );
}

function CommunityScreen() {
  const handleAmen = (i: number) => {
    toast.success("Amen! Request received.", { icon: <Sparkles className="h-4 w-4 text-blue-500" /> });
  };

  return (
    <div className="screen-padding pb-24">
      <h2 className="text-2xl font-black mb-6 tracking-tighter uppercase text-blue-600 leading-none">Wall of<br/>Grace</h2>
      
      <div className="space-y-4">
        {[
          { author: 'Sarah Miller', type: 'Testimony', msg: 'The youth conference last week changed my life. I found the purpose I was looking for!', time: '2h ago' },
          { author: 'Bishop David', type: 'Announcement', msg: 'Join us for mandatory prayer fellowship this Friday as we prepare for the crusade.', time: '5h ago' },
          { author: 'Samuel K.', type: 'Prayer Request', msg: 'Interceding for my family back home. Please stands with me in prayers.', time: '1d ago' }
        ].map((v, i) => (
          <Card key={i} className="rounded-2xl border-none shadow-sm bg-white p-5 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 ring-2 ring-blue-50">
                  <AvatarFallback className="bg-blue-50 font-black text-blue-600 text-[10px]">{v.author[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-black text-slate-900 text-[10px] uppercase tracking-tight leading-none">{v.author}</p>
                  <p className="text-[7px] text-slate-400 font-black mt-1 uppercase tracking-tighter">{v.time}</p>
                </div>
              </div>
              <Badge className={cn(
                "rounded-full px-2 py-0.5 font-black text-[6px] uppercase border-none",
                v.type === 'Testimony' ? 'bg-blue-600 text-white' : 
                v.type === 'Announcement' ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600'
              )}>
                {v.type}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed font-bold italic">"{v.msg}"</p>
            <div className="mt-4 pt-3 border-t border-slate-50 flex gap-4">
               <button onClick={() => handleAmen(i)} className="text-[8px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 active:scale-95">
                 <Heart size={10} /> Amen
               </button>
               <button className="text-[8px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1.5 active:scale-95">
                 <Plus size={10} /> Share
               </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen({ profile, onUpdate }: any) {
  const [loading, setLoading] = useState(false);
  const [church, setChurch] = useState(profile?.churchName || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [orgEmail, setOrgEmail] = useState(profile?.orgEmail || '');

  const handleUpdate = async () => {
    if (!church) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', profile.userId), { 
        churchName: church,
        website: website,
        orgEmail: orgEmail
      }, { merge: true });
      toast.success("Registry synchronized successfully");
      onUpdate();
    } catch (e) {
      toast.error("Process failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-padding h-full pb-24">
      <h2 className="text-2xl font-black mb-6 tracking-tighter uppercase text-slate-900 leading-none">Holy Registry</h2>
      
      <Card className="rounded-2xl bg-slate-900 p-6 text-white mb-6 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl opacity-50" />
         <div className="flex flex-col items-center text-center relative z-10">
           <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-3 backdrop-blur-md border border-white/10">
              <Users className="h-5 w-5 text-blue-400" />
           </div>
           <h3 className="text-sm font-black tracking-tight uppercase">{profile?.churchName || "Organization"}</h3>
           <div className="flex items-center gap-2 mt-1">
             <Badge className={cn(
                "text-[6px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                profile?.verificationStatus === 'verified' ? 'bg-blue-500 text-white' : 
                profile?.verificationStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300'
              )}>
               {profile?.verificationStatus || 'unverified'}
             </Badge>
           </div>
         </div>
      </Card>

      <div className="space-y-4">
        <div className="space-y-3">
           <div className="space-y-1.5">
             <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Entity Nomenclature</Label>
             <Input 
              value={church}
              onChange={e => setChurch(e.target.value)}
              className="h-12 rounded-xl bg-white border-slate-100 font-bold px-5 text-slate-700 text-[10px]" 
             />
           </div>

           <div className="space-y-1.5">
             <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Registry Email</Label>
             <Input 
              value={orgEmail}
              onChange={e => setOrgEmail(e.target.value)}
              className="h-12 rounded-xl bg-white border-slate-100 font-bold px-5 text-slate-700 text-[10px]" 
             />
           </div>

           <div className="space-y-1.5">
             <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Digital Coordinates</Label>
             <Input 
              value={website}
              onChange={e => setWebsite(e.target.value)}
              className="h-12 rounded-xl bg-white border-slate-100 font-bold px-5 text-slate-700 text-[10px]" 
             />
           </div>
        </div>

        <Button 
          onClick={handleUpdate}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-blue-600 font-black shadow-xl shadow-blue-100 mb-8 uppercase tracking-widest text-[10px] text-white"
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Synchronize Data"}
        </Button>
      </div>
    </div>
  );
}


function CreateEventScreen({ onCreated }: any) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Outreach',
    description: '',
    date: '',
    location: '',
    venueType: 'In-person',
    speaker: ''
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    setUploading(true);
    try {
      const storageRef = ref(storage, `event-banners/${Date.now()}-${imageFile.name}`);
      const snapshot = await uploadBytes(storageRef, imageFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      if (error.code === 'storage/retry-limit-exceeded') {
        toast.error("Upload failed: Connection timed out. Please try a smaller image or check your network.");
      } else {
        toast.error("Failed to upload image: " + (error.message || "Unknown error"));
      }
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      let bannerUrl = '';
      if (imageFile) {
        const url = await uploadImage();
        if (url) bannerUrl = url;
      }

      await addDoc(collection(db, "events"), {
        ...formData,
        bannerUrl,
        date: Timestamp.fromDate(new Date(formData.date)),
        creatorId: auth.currentUser?.uid,
        status: 'Published',
        createdAt: Timestamp.now()
      });
      toast.success("Event broadcasted successfully!");
      onCreated();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const generateDescription = async () => {
    if (!formData.title) return toast.error("Please enter a title first");
    setLoading(true);
    try {
      const resp = await fetch('/api/ai/event-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formData.title, details: formData.description })
      });
      const data = await resp.json();
      setFormData(prev => ({ ...prev, description: data.description }));
    } catch (e) {
      toast.error("AI generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-padding bg-slate-50/10 min-h-full pb-24">
      <div className="mb-4 pt-4">
        <h2 className="text-lg font-black tracking-tighter uppercase text-blue-600 leading-none">New Event</h2>
        <p className="text-[7px] text-blue-400 font-black mt-1.5 uppercase tracking-[0.2em]">Prophetic Broadcast Center</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image Upload Feature */}
        <div className="space-y-1.5">
          <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Event Banner</Label>
          <div className="relative group">
            {imagePreview ? (
              <div className="relative h-28 w-full rounded-2xl overflow-hidden shadow-lg">
                <img src={imagePreview} className="w-full h-full object-cover" alt="Banner preview" />
                <div 
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full cursor-pointer hover:bg-black/70 transition-colors"
                >
                  <Plus className="h-2.5 w-2.5 rotate-45" />
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-28 w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-blue-50/30 hover:border-blue-200 transition-all group">
                <div className="bg-white p-2.5 rounded-xl shadow-sm mb-1.5 group-hover:block transition-all">
                  <Plus className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Upload Banner Artwork</p>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-[8px] font-black uppercase tracking-widest text-blue-400 ml-1">Event Title</Label>
          <Input id="title" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} 
            className="h-10 border-blue-50 bg-blue-50/20 focus:bg-white focus:ring-blue-500 rounded-xl px-4 font-bold text-blue-900 transition-all placeholder:text-slate-400 placeholder:font-normal text-xs" placeholder="e.g. Global Grace Crusade" />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-[8px] font-black uppercase tracking-widest text-blue-400 ml-1">Category</Label>
            <Select onValueChange={v => setFormData({ ...formData, category: v })} value={formData.category}>
              <SelectTrigger className="h-10 border-blue-50 bg-white rounded-xl px-4 font-bold text-blue-900 text-xs shadow-sm shadow-blue-50/50">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-white border-blue-50 rounded-xl shadow-xl z-50">
                {['Outreach', 'Conference', 'Prayer Meeting', 'Youth Program', 'Training', 'Crusade'].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-[8px] font-black uppercase tracking-widest text-blue-400 ml-1">Schedule</Label>
            <Input id="date" type="datetime-local" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} 
              className="h-10 border-blue-50 bg-blue-50/20 rounded-xl px-3 font-medium text-blue-900 text-[10px]" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center px-1">
            <Label htmlFor="description" className="text-[8px] font-black uppercase tracking-widest text-blue-400">Description</Label>
            <Badge variant="outline" className="cursor-pointer gap-1.5 bg-blue-600 text-white border-none hover:bg-blue-700 py-0.5 px-2 rounded-full font-bold transition-all active:scale-95 text-[7px]" onClick={generateDescription}>
               <Sparkles className="h-2 w-2" /> AI Generate
            </Badge>
          </div>
          <textarea id="description" required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full min-h-[100px] p-3 bg-blue-50/20 border border-blue-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all font-medium text-blue-900 leading-relaxed text-[10px] placeholder:text-slate-400 placeholder:font-normal" placeholder="Detailed plan or vision for the event..." />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location" className="text-[8px] font-black uppercase tracking-widest text-blue-400 ml-1">Venue / Online Link</Label>
          <Input id="location" required value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} 
            className="h-10 border-blue-50 bg-blue-50/20 rounded-xl px-4 font-bold text-blue-900 placeholder:text-slate-400 placeholder:font-normal text-xs" placeholder="e.g. Main Stadium or Zoom URL" />
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 text-xs rounded-xl bg-blue-600 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 font-bold mt-2 active:scale-95">
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Broadcast to Ministry"}
        </Button>
      </form>
    </div>
  );
}

function NotificationsScreen() {
  return (
    <div className="screen-padding h-[75vh] flex flex-col items-center justify-center bg-blue-50/10 pb-24">
      <div className="mb-10 text-center">
        <h2 className="text-xl font-black tracking-tighter uppercase text-blue-600 leading-none">Notifications</h2>
        <p className="text-[7px] text-blue-400 font-black mt-2 uppercase tracking-[0.3em] opacity-60">Divine Transmission Hub</p>
      </div>
      
      <div className="flex flex-col items-center justify-center text-center px-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-blue-100 flex items-center justify-center mb-6 border border-blue-50 relative"
        >
          <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-full" />
          <Bell className="h-8 w-8 text-blue-500 relative z-10" />
        </motion.div>
        <h3 className="text-lg font-black text-blue-600 mb-1.5 tracking-tight uppercase">Holy Silence</h3>
        <p className="text-[7px] text-blue-400 font-medium leading-relaxed uppercase tracking-widest max-w-[160px] opacity-60">No new alerts detected in your broadcast frequency.</p>
        
        <Button variant="outline" className="mt-8 rounded-2xl h-12 border-blue-100 bg-white text-blue-600 font-black px-8 uppercase tracking-widest text-[8px] active:scale-95 transition-all shadow-sm group hover:border-blue-200">
          <Sparkles className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
          Refresh Channel
        </Button>
      </div>
    </div>
  );
}

function EventRegistrationScreen({ event, onRegister, onBack }: { event: any, onRegister: (data: any) => void, onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.phone) {
      return toast.error("All mission coordinates are required");
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return toast.error("Invalid correspondence link (email)");
    }

    setLoading(true);
    try {
      await onRegister(formData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen-padding h-full flex flex-col bg-slate-50/10 pb-24 overflow-y-auto">
      <header className="mb-8 pt-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-black text-[8px] uppercase tracking-[0.2em] mb-4 hover:text-blue-600 transition-colors">
          <ChevronRight className="rotate-180 h-3 w-3" /> Back to Details
        </button>
        <h2 className="text-3xl font-black tracking-tighter uppercase text-blue-900 leading-none">Register For<br/><span className="text-blue-600">This Gathering</span></h2>
        <p className="text-[7px] text-blue-400 font-black mt-2 uppercase tracking-[0.3em]">SECURE YOUR ACCESS CODE</p>
      </header>

      <Card className="rounded-[2.5rem] bg-white border border-blue-50 shadow-xl shadow-blue-100 p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl opacity-50" />
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <Label className="text-[8px] font-black text-blue-400 uppercase tracking-widest ml-1">Identity Nomenclature</Label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300" />
              <Input 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full Name"
                className="h-12 pl-11 rounded-xl bg-blue-50/20 border-blue-50 font-bold text-blue-900 text-xs focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[8px] font-black text-blue-400 uppercase tracking-widest ml-1">Correspondence Link</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300" />
              <Input 
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email Address"
                className="h-12 pl-11 rounded-xl bg-blue-50/20 border-blue-50 font-bold text-blue-900 text-xs focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[8px] font-black text-blue-400 uppercase tracking-widest ml-1">Vocal Frequency (Phone)</Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-300" />
              <Input 
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone Number"
                className="h-12 pl-11 rounded-xl bg-blue-50/20 border-blue-50 font-bold text-blue-900 text-xs focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-14 rounded-2xl bg-blue-600 font-black shadow-xl shadow-blue-100 uppercase tracking-widest text-xs text-white hover:bg-blue-700 active:scale-95 transition-all"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Initiate Secure Registration"}
            </Button>
            <p className="text-center text-[7px] text-slate-300 font-bold uppercase tracking-[0.2em] mt-4">One access code per coordinate</p>
          </div>
        </form>
      </Card>

      <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100">
         <div className="flex items-start gap-4">
            <div className="bg-blue-600 p-2 rounded-xl shrink-0">
               <Calendar size={12} className="text-white" />
            </div>
            <div>
               <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-tight mb-1">{event.title}</h4>
               <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{event.location}</p>
            </div>
         </div>
      </div>
    </div>
  );
}

function AttendeeManagementScreen({ event, onBack }: { event: ChurchEvent, onBack: () => void }) {
  const [attendees, setAttendees] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState("");

  const volunteerRoles = [
      "Usher", "Security", "Choir", "Technical", "Hospitality", "Medical", "Protocol"
  ];

  useEffect(() => {
    const fetchAttendees = async () => {
      try {
        const q = query(collection(db, 'registrations'), where('eventId', '==', event.id));
        const snap = await getDocs(q);
        setAttendees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Registration[]);
      } catch (e) {
        toast.error("Failed to fetch attendees");
      } finally {
        setLoading(false);
      }
    };
    fetchAttendees();
  }, [event.id]);

  const handleAssignRole = async (regId: string) => {
    if (!selectedRole) return toast.error("Select a role first");
    try {
      await updateDoc(doc(db, 'registrations', regId), {
        volunteerRole: selectedRole
      });
      setAttendees(prev => prev.map(a => a.id === regId ? { ...a, volunteerRole: selectedRole } : a));
      toast.success("Assignment Confirmed");
      setAssigningId(null);
      setSelectedRole("");
    } catch (e) {
      toast.error("Assignment failed");
    }
  };

  return (
    <div className="screen-padding pb-24">
       <div className="flex justify-between items-center mb-6 px-1 pt-6 text-right">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full bg-slate-100 text-slate-800">
             <ChevronRight className="rotate-180 h-4 w-4" />
          </Button>
          <div className="text-right">
             <h2 className="text-xl font-black text-blue-900 tracking-tighter uppercase leading-none">Attendee Mgmt</h2>
             <p className="text-[7px] text-blue-400 font-black mt-2 uppercase tracking-widest leading-none truncate max-w-[180px]">{event.title}</p>
          </div>
       </div>

       {loading ? (
         <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
       ) : (
         <div className="space-y-4">
            {attendees.map(a => (
              <Card key={a.id} className="p-5 border-none shadow-sm rounded-3xl overflow-hidden relative group">
                 <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                       <Avatar className="h-10 w-10 border-2 border-slate-50">
                          <AvatarFallback className="text-blue-600 font-bold bg-blue-50 uppercase">{a.attendeeName?.[0] || '?'}</AvatarFallback>
                       </Avatar>
                       <div>
                          <p className="font-black text-slate-800 uppercase text-[10px]">{a.attendeeName || 'Anonymous Saint'}</p>
                          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">{a.attendeeEmail || 'Email Protected'}</p>
                       </div>
                    </div>
                    {a.volunteerRole && (
                      <Badge className="bg-blue-600 text-white border-none font-black text-[6px] uppercase tracking-widest px-2">{a.volunteerRole}</Badge>
                    )}
                 </div>

                 <div className="mt-4 pt-4 border-t border-slate-50 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${a.status === 'Checked-in' ? 'bg-green-500' : 'bg-blue-400'}`} />
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{a.status}</span>
                       </div>

                       {assigningId !== a.id && (
                          <Button 
                            variant="outline" 
                            onClick={() => setAssigningId(a.id)}
                            className="h-8 rounded-xl border-dashed border-blue-200 text-blue-600 font-black text-[8px] uppercase tracking-widest hover:bg-blue-50 transition-all px-4"
                          >
                            {a.volunteerRole ? "Change Role" : "Assign Role"}
                          </Button>
                       )}
                    </div>
                    
                    {assigningId === a.id && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-2 w-full">
                         <select 
                           value={selectedRole} 
                           onChange={e => setSelectedRole(e.target.value)}
                           className="flex-1 h-10 bg-slate-50 border-none rounded-xl px-3 text-[9px] font-bold uppercase tracking-tight focus:ring-1 ring-blue-200 outline-none"
                         >
                            <option value="">Select Role</option>
                            {volunteerRoles.map(r => <option key={r} value={r}>{r}</option>)}
                         </select>
                         <div className="flex gap-1">
                            <Button onClick={() => handleAssignRole(a.id)} className="h-10 px-4 rounded-xl bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest">Assign</Button>
                            <Button onClick={() => setAssigningId(null)} variant="ghost" className="h-10 px-2 rounded-xl text-slate-300">
                               <Plus className="rotate-45 h-4 w-4" />
                            </Button>
                         </div>
                      </motion.div>
                    )}
                 </div>
              </Card>
            ))}
            {attendees.length === 0 && (
              <div className="text-center py-20 px-8">
                 <Users className="mx-auto h-12 w-12 text-slate-100 mb-6" />
                 <h3 className="text-lg font-black text-slate-300 uppercase tracking-tighter">No attendees yet</h3>
                 <p className="text-[8px] font-black text-slate-200 uppercase tracking-widest mt-2">Await the call for registration.</p>
              </div>
            )}
         </div>
       )}
    </div>
  );
}
